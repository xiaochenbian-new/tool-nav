/**
 * tool-nav：从 IndexedDB 物理下载结果提供 JS/CSS（非 Cache Storage）
 * - 命中本地文件 → 直接 Response(blob)
 * - 未命中 → 网络（不写入 Cache API）
 * - 激活时清掉历史 tool-nav Cache Storage
 */
/* eslint-disable no-restricted-globals */
var DB_NAME = "tool-nav-offline-files";
var DB_VERSION = 1;
var STORE = "files";

function openDb() {
    return new Promise(function (resolve, reject) {
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
            resolve(req.result);
        };
        req.onerror = function () {
            reject(req.error);
        };
    });
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
            tx.oncomplete = function () {
                db.close();
            };
            tx.onerror = function () {
                db.close();
            };
        });
    });
}

function assetKey(url, scopeUrl) {
    try {
        var u = new URL(url);
        var scope = new URL(scopeUrl);
        var path = u.pathname;
        var base = scope.pathname;
        if (base && path.indexOf(base) === 0) path = path.slice(base.length);
        return path.replace(/^\/+/, "");
    } catch (e) {
        return "";
    }
}

function isStaticAsset(pathname) {
    return /\.(?:js|mjs|cjs|css|woff2?|ttf|otf|eot|wasm|map|svg)(?:\/?)$/i.test(pathname);
}

function isSameOriginScope(url) {
    if (url.origin !== self.location.origin) return false;
    var scopePath = new URL(self.registration.scope).pathname;
    return url.pathname.indexOf(scopePath) === 0;
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

    var key = assetKey(request.url, self.registration.scope);
    if (!key) return;

    event.respondWith(
        idbGet(key)
            .then(function (row) {
                if (row && row.blob) {
                    var headers = {
                        "Content-Type": row.contentType || "application/octet-stream",
                        "X-Tool-Nav-Offline": "1"
                    };
                    return new Response(row.blob, { status: 200, headers: headers });
                }
                return fetch(request);
            })
            .catch(function () {
                return fetch(request);
            })
    );
});
