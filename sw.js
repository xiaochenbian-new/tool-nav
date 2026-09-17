/**
 * tool-nav 静态资源本地缓存
 * - JS/CSS/字体/图片/vendor：缓存优先
 * - HTML（含工具页）：优先返回本地缓存，后台静默更新（避免弱网每次等远程）
 * - 缓存键忽略 ?_toolNavId 等查询参数，避免同一工具页反复 miss
 * - 仅在 http(s) 下由 index.html 注册；uTools file:// 不受影响
 */
/* eslint-disable no-restricted-globals */
var CACHE_NAME = "tool-nav-static-v2";
var STATIC_EXT =
    /\.(?:js|mjs|cjs|css|woff2?|ttf|otf|eot|map|wasm|png|jpe?g|gif|svg|ico|webp)(?:\?.*)?$/i;

self.addEventListener("install", function (event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            var base = self.registration.scope;
            return cache
                .addAll(
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

/** 去掉 query/hash，保证 pages/xxx.html?_toolNavId=… 能命中同一缓存 */
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
    // 同源 basic；偶发 cors
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

/** 有缓存立刻返回，后台刷新；无缓存再走网络 */
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
        // 工具页 HTML 也优先本地，避免弱网下「打开过还要等加载」
        event.respondWith(staleWhileRevalidate(request));
    }
});
