/**
 * tool-nav：从 IndexedDB 物理下载结果提供静态资源（非 Cache Storage）
 * - 命中本地文件 → Response(blob)
 * - 未命中 → 网络（不写 Cache API）
 * - 激活时清掉历史 tool-nav Cache Storage，并 clients.claim
 */
/* eslint-disable no-restricted-globals */
var DB_NAME = "tool-nav-offline-files";
var DB_VERSION = 1;
var STORE = "files";
var dbPromise = null;

function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function () {
            var db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "key" });
            }
            if (!db.objectStoreNames.contains("meta")) {
                db.createObjectStore("meta", { keyPath: "key" });
            }
        };
        req.onsuccess = function () {
            var db = req.result;
            db.onversionchange = function () {
                try {
                    db.close();
                } catch (e) {}
                dbPromise = null;
            };
            resolve(db);
        };
        req.onerror = function () {
            dbPromise = null;
            reject(req.error);
        };
    });
    return dbPromise;
}

function idbGet(key) {
    return openDb().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(STORE, "readonly");
            var req = tx.objectStore(STORE).get(key);
            req.onsuccess = function () {
                resolve(req.result || null);
            };
            req.onerror = function () {
                reject(req.error);
            };
        });
    });
}

function idbGetFirst(keys) {
    var i = 0;
    function next() {
        if (i >= keys.length) return Promise.resolve(null);
        var key = keys[i++];
        if (!key) return next();
        return idbGet(key).then(function (row) {
            if (row && row.blob) return row;
            return next();
        });
    }
    return next();
}

function normalizeScopePath(scopePath) {
    if (!scopePath) return "/";
    return scopePath.endsWith("/") ? scopePath : scopePath + "/";
}

function assetKeysForRequest(url, scopeUrl) {
    var keys = [];
    try {
        var u = new URL(url);
        var scope = new URL(scopeUrl);
        var path = decodeURIComponent(u.pathname);
        var base = normalizeScopePath(scope.pathname || "/");
        var rel;
        if (path.indexOf(base) === 0) {
            rel = path.slice(base.length);
        } else if (base !== "/" && path.indexOf(base.replace(/\/+$/, "")) === 0) {
            rel = path.slice(base.replace(/\/+$/, "").length).replace(/^\/+/, "");
        } else {
            rel = path.replace(/^\/+/, "");
        }
        rel = rel.replace(/^\/+/, "");
        if (rel) {
            keys.push(rel);
            try {
                var enc = rel
                    .split("/")
                    .map(function (p) {
                        return encodeURIComponent(decodeURIComponent(p));
                    })
                    .join("/");
                if (enc !== rel) keys.push(enc);
            } catch (e2) {}
        }
    } catch (e) {}
    return keys;
}

function isStaticAsset(pathname) {
    return /\.(?:js|mjs|cjs|css|woff2?|ttf|otf|eot|wasm|map|svg|png|jpe?g|gif|webp|ico|json|html)(?:\/)?$/i.test(
        pathname
    );
}

function isSameOriginScope(url) {
    if (url.origin !== self.location.origin) return false;
    var scopePath = normalizeScopePath(new URL(self.registration.scope).pathname || "/");
    var path = url.pathname.endsWith("/") ? url.pathname : url.pathname;
    // scope `/tool-nav/` should match `/tool-nav/...`
    if (scopePath === "/") return true;
    var bare = scopePath.replace(/\/+$/, "");
    return path === bare || path.indexOf(scopePath) === 0 || path.indexOf(bare + "/") === 0;
}

function localResponse(row) {
    var headers = {
        "Content-Type": row.contentType || "application/octet-stream",
        "X-Tool-Nav-Offline": "1",
        "Cache-Control": "no-store"
    };
    return new Response(row.blob, { status: 200, statusText: "OK", headers: headers });
}

self.addEventListener("install", function (event) {
    self.skipWaiting();
    event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        Promise.resolve()
            .then(function () {
                if (!("caches" in self)) return;
                return caches.keys().then(function (keys) {
                    return Promise.all(
                        keys
                            .filter(function (key) {
                                return key.indexOf("tool-nav-") === 0;
                            })
                            .map(function (key) {
                                return caches.delete(key);
                            })
                    );
                });
            })
            .then(function () {
                return self.clients.claim();
            })
    );
});

self.addEventListener("message", function (event) {
    var data = event.data || {};
    if (data.type === "tool-nav-offline-claim") {
        event.waitUntil(self.clients.claim());
    }
});

self.addEventListener("fetch", function (event) {
    var request = event.request;
    if (request.method !== "GET") return;

    var url;
    try {
        url = new URL(request.url);
    } catch (e) {
        return;
    }
    if (!isSameOriginScope(url)) return;
    if (url.pathname.replace(/\/+$/, "").endsWith("/sw.js")) return;
    if (!isStaticAsset(url.pathname)) return;

    var keys = assetKeysForRequest(request.url, self.registration.scope);
    if (!keys.length) return;

    event.respondWith(
        idbGetFirst(keys)
            .then(function (row) {
                if (row && row.blob) return localResponse(row);
                return fetch(request);
            })
            .catch(function () {
                return fetch(request);
            })
    );
});
