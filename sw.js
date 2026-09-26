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

function pushAssetKey(keys, rel) {
    if (!rel || keys.indexOf(rel) >= 0) return;
    keys.push(rel);
    try {
        var enc = rel
            .split("/")
            .map(function (p) {
                if (!p) return "";
                return encodeURIComponent(decodeURIComponent(p));
            })
            .join("/");
        if (enc !== rel && keys.indexOf(enc) < 0) keys.push(enc);
    } catch (e2) {}
    // CF pretty URL：请求无后缀时也能命中离线库里的 *.html
    if (/\.html?$/i.test(rel)) {
        var bare = rel.replace(/\.html?$/i, "");
        if (bare && keys.indexOf(bare) < 0) keys.push(bare);
    } else {
        var leaf = (rel.split("/").pop() || "");
        if (leaf && !/\.[a-z0-9]+$/i.test(leaf)) {
            var withHtml = rel + ".html";
            if (keys.indexOf(withHtml) < 0) keys.push(withHtml);
        }
    }
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
        pushAssetKey(keys, rel);
    } catch (e) {}
    return keys;
}

function isStaticAsset(pathname) {
    var decoded = pathname;
    try {
        decoded = decodeURIComponent(pathname);
    } catch (e) {}
    if (
        /\.(?:js|mjs|cjs|css|woff2?|ttf|otf|eot|wasm|map|svg|png|jpe?g|gif|webp|ico|json|html)(?:\/)?$/i.test(
            decoded
        )
    ) {
        return true;
    }
    // Cloudflare pretty URL：/pages/中文工具 无后缀
    var trimmed = decoded.replace(/\/+$/, "");
    var leaf = trimmed.split("/").pop() || "";
    if (!leaf || /\.[a-z0-9]+$/i.test(leaf)) return false;
    return (
        /\/pages\//i.test(decoded) ||
        /\/photo-background-change(?:\/|$)/i.test(decoded) ||
        /\/404$/i.test(trimmed)
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

function mimeMatchesKey(key, contentType) {
    var k = String(key || "").toLowerCase();
    var type = String(contentType || "").toLowerCase();
    if (!type) return true;
    if (/\.(?:js|mjs|cjs)$/i.test(k)) {
        if (type.indexOf("text/html") === 0) return false;
        return (
            type.indexOf("javascript") >= 0 ||
            type.indexOf("ecmascript") >= 0 ||
            type.indexOf("octet-stream") >= 0 ||
            type.indexOf("text/plain") >= 0
        );
    }
    if (/\.css$/i.test(k) && type.indexOf("text/html") === 0) return false;
    if (/\.json$/i.test(k) && type.indexOf("text/html") === 0) return false;
    return true;
}

function isPoisonedShellHtml(key, blob) {
    var k = String(key || "").toLowerCase();
    if (!blob || k.indexOf("pages/") !== 0 || !/\.html$/i.test(k)) {
        return Promise.resolve(false);
    }
    return blob
        .slice(0, 1200)
        .text()
        .then(function (head) {
            return /id=["']brand-title["']/.test(head) || /<title>\s*工具大全\s*<\/title>/.test(head);
        })
        .catch(function () {
            return false;
        });
}

function localResponse(row) {
    var key = (row && row.key) || "";
    var contentType = (row && row.contentType) || "application/octet-stream";
    if (!mimeMatchesKey(key, contentType)) return Promise.resolve(null);
    return isPoisonedShellHtml(key, row.blob).then(function (poisoned) {
        if (poisoned) return null;
        var headers = {
            "Content-Type": contentType,
            "X-Tool-Nav-Offline": "1",
            "Cache-Control": "no-store"
        };
        return new Response(row.blob, { status: 200, statusText: "OK", headers: headers });
    });
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
                if (row && row.blob) {
                    return localResponse(row).then(function (local) {
                        if (local) return local;
                        return fetch(request);
                    });
                }
                return fetch(request);
            })
            .catch(function () {
                return fetch(request);
            })
    );
});
