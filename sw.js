/**
 * tool-nav 静态资源本地缓存
 * - 首次访问某 JS/CSS（及字体/图片等）时写入 Cache Storage
 * - 之后优先走本地缓存，弱网/断网仍可继续使用已打开过的工具
 * - HTML 走网络优先，失败再回退缓存，便于发版更新
 * - 仅在 http(s) 下由 index.html 注册；uTools file:// 不受影响（资源本身已在包内）
 */
/* eslint-disable no-restricted-globals */
var CACHE_NAME = "tool-nav-static-v1";
var STATIC_EXT =
    /\.(?:js|mjs|cjs|css|woff2?|ttf|otf|eot|map|wasm|png|jpe?g|gif|svg|ico|webp)(?:\?.*)?$/i;

self.addEventListener("install", function (event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            var base = self.registration.scope;
            return cache.addAll(
                [
                    base,
                    base + "index.html",
                    base + "pages/libs/tool-calendar.css",
                    base + "pages/libs/tool-calendar.js",
                    base + "pages/libs/tool-calculator.css",
                    base + "pages/libs/tool-calculator.js",
                    base + "pages/libs/tool-form-persist.js"
                ].map(function (url) {
                    return new Request(url, { cache: "reload" });
                })
            ).catch(function () {
                // 预缓存失败不影响后续按需缓存
            });
        })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches
            .keys()
            .then(function (keys) {
                return Promise.all(
                    keys
                        .filter(function (key) {
                            return key.indexOf("tool-nav-") === 0 && key !== CACHE_NAME;
                        })
                        .map(function (key) {
                            return caches.delete(key);
                        })
                );
            })
            .then(function () {
                return self.clients.claim();
            })
    );
});

function putInCache(request, response) {
    if (!response || !response.ok) return response;
    var copy = response.clone();
    caches.open(CACHE_NAME).then(function (cache) {
        cache.put(request, copy);
    });
    return response;
}

function cacheFirst(request) {
    return caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request)
            .then(function (response) {
                return putInCache(request, response);
            })
            .catch(function () {
                return cached || Response.error();
            });
    });
}

function networkFirst(request) {
    return fetch(request)
        .then(function (response) {
            return putInCache(request, response);
        })
        .catch(function () {
            return caches.match(request).then(function (cached) {
                if (cached) return cached;
                if (request.mode === "navigate") {
                    return caches.match(self.registration.scope + "index.html");
                }
                return Response.error();
            });
        });
}

function isSameOriginScope(url) {
    if (url.origin !== self.location.origin) return false;
    var scopePath = new URL(self.registration.scope).pathname;
    return url.pathname.indexOf(scopePath) === 0;
}

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

    // 不拦截 Service Worker 自身，避免更新困难
    if (url.pathname.replace(/\/+$/, "").endsWith("/sw.js")) return;

    var isStatic =
        STATIC_EXT.test(url.pathname) ||
        url.pathname.indexOf("/vendor/") !== -1 ||
        url.pathname.indexOf("/pages/libs/") !== -1;
    var isHtml =
        url.pathname.endsWith(".html") ||
        url.pathname.endsWith("/") ||
        request.mode === "navigate";

    if (isStatic) {
        event.respondWith(cacheFirst(request));
        return;
    }
    if (isHtml) {
        event.respondWith(networkFirst(request));
    }
});
