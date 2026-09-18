/**
 * tool-nav 轻量静态缓存（v3）
 * - 仅缓存 /vendor/（大库、不可变）与 /pages/libs/（共用小脚本）
 * - 不再缓存全部 JS/CSS，也不再缓存工具 HTML（避免 Cache 膨胀与切换卡死）
 * - vendor：缓存优先；pages/libs：有缓存先返回并后台刷新
 * - 仅在 http(s) 下由 index.html 注册；uTools file:// 不受影响
 */
/* eslint-disable no-restricted-globals */
var CACHE_NAME = "tool-nav-static-v3";

self.addEventListener("install", function (event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            var base = self.registration.scope;
            return cache
                .addAll(
                    [
                        base + "pages/libs/tool-calendar.css",
                        base + "pages/libs/tool-calendar.js",
                        base + "pages/libs/tool-calculator.css",
                        base + "pages/libs/tool-calculator.js",
                        base + "pages/libs/tool-form-persist.js"
                    ].map(function (url) {
                        return new Request(url, { cache: "reload" });
                    })
                )
                .catch(function () {
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
                            // 清掉 v1/v2 全量 JS/CSS/HTML 缓存，以及其它 tool-nav-* 旧桶
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

function cacheKey(request) {
    try {
        var url = new URL(request.url);
        url.search = "";
        url.hash = "";
        return url.href;
    } catch (e) {
        return request.url;
    }
}

function canCacheResponse(response) {
    if (!response || !response.ok) return false;
    return response.type === "basic" || response.type === "cors";
}

function putInCache(request, response) {
    if (!canCacheResponse(response)) return response;
    var copy = response.clone();
    var key = cacheKey(request);
    caches.open(CACHE_NAME).then(function (cache) {
        cache.put(key, copy);
    });
    return response;
}

function matchCache(request) {
    var key = cacheKey(request);
    return caches.match(key).then(function (hit) {
        if (hit) return hit;
        return caches.match(request, { ignoreSearch: true });
    });
}

function fetchAndCache(request) {
    return fetch(request).then(function (response) {
        return putInCache(request, response);
    });
}

function staleWhileRevalidate(request) {
    return matchCache(request).then(function (cached) {
        var networkPromise = fetchAndCache(request).catch(function () {
            return null;
        });
        if (cached) {
            networkPromise.then(function () {});
            return cached;
        }
        return networkPromise.then(function (response) {
            return response || Response.error();
        });
    });
}

function cacheFirst(request) {
    return matchCache(request).then(function (cached) {
        if (cached) return cached;
        return fetchAndCache(request).catch(function () {
            return Response.error();
        });
    });
}

function isSameOriginScope(url) {
    if (url.origin !== self.location.origin) return false;
    var scopePath = new URL(self.registration.scope).pathname;
    return url.pathname.indexOf(scopePath) === 0;
}

/** 只拦截有必要落盘的路径，其它 JS/CSS/HTML 交回浏览器默认缓存策略 */
function cacheKind(pathname) {
    if (pathname.indexOf("/vendor/") !== -1) return "vendor";
    if (pathname.indexOf("/pages/libs/") !== -1) return "libs";
    return null;
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
    if (url.pathname.replace(/\/+$/, "").endsWith("/sw.js")) return;

    var kind = cacheKind(url.pathname);
    if (!kind) return;

    if (kind === "vendor") {
        event.respondWith(cacheFirst(request));
        return;
    }
    event.respondWith(staleWhileRevalidate(request));
});
