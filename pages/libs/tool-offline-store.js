/**
 * tool-nav 物理下载（IndexedDB）
 * - 首次打开站点即后台下载全部工具静态资源
 * - 已下载的不重复拉取；刷新后直接复用本地
 * - Service Worker 从 IDB 优先响应
 */
(function (global) {
    "use strict";

    var DB_NAME = "tool-nav-offline-files";
    var DB_VERSION = 1;
    var STORE = "files";
    var META_STORE = "meta";
    var VISITED_KEY = "tool-nav:offline-visited";
    var MANIFEST_URL = "asset-manifest.json";

    var state = {
        ready: false,
        enabled: false,
        manifest: null,
        queue: [],
        queuedSet: Object.create(null),
        targets: Object.create(null),
        targetCount: 0,
        doneCount: 0,
        localCount: 0,
        /** in-memory set of keys known present in IDB */
        localKeys: Object.create(null),
        busy: false,
        pauseUntil: 0,
        timer: null,
        gapMs: 80,
        clearing: false,
        listeners: [],
        db: null
    };

    function canUseOffline() {
        if (!("indexedDB" in global)) return false;
        var protocol = global.location.protocol;
        var host = global.location.hostname;
        return (
            protocol === "https:" ||
            ((host === "localhost" || host === "127.0.0.1") && protocol === "http:")
        );
    }

    function emit() {
        var snap = getSnapshot();
        state.listeners.forEach(function (fn) {
            try {
                fn(snap);
            } catch (e) {}
        });
    }

    function getSnapshot() {
        var total = state.targetCount;
        var done = Math.min(state.doneCount, total);
        var pct = total > 0 ? Math.round((done / total) * 100) : state.localCount > 0 ? 100 : 0;
        var downloading = !!(state.busy || state.queue.length > 0);
        var complete = total > 0 ? done >= total && !downloading : state.localCount > 0 && !downloading;
        return {
            enabled: state.enabled,
            ready: state.ready,
            percent: complete && total === 0 && state.localCount > 0 ? 100 : pct,
            done: done,
            total: total,
            localCount: state.localCount,
            queueLeft: state.queue.length,
            downloading: downloading,
            complete: complete
        };
    }

    function openDb() {
        if (state.db) return Promise.resolve(state.db);
        return new Promise(function (resolve, reject) {
            var req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function () {
                var db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: "key" });
                }
                if (!db.objectStoreNames.contains(META_STORE)) {
                    db.createObjectStore(META_STORE, { keyPath: "key" });
                }
            };
            req.onsuccess = function () {
                state.db = req.result;
                state.db.onversionchange = function () {
                    try {
                        state.db.close();
                    } catch (e) {}
                    state.db = null;
                };
                resolve(state.db);
            };
            req.onerror = function () {
                reject(req.error);
            };
        });
    }

    function idbReq(req) {
        return new Promise(function (resolve, reject) {
            req.onsuccess = function () {
                resolve(req.result);
            };
            req.onerror = function () {
                reject(req.error);
            };
        });
    }

    /** 先挂 tx 完成回调，再跑请求，避免错过 oncomplete */
    function withStore(mode, storeName, fn) {
        return openDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(storeName, mode);
                var store = tx.objectStore(storeName);
                var settled = false;
                var result;
                tx.oncomplete = function () {
                    if (settled) return;
                    settled = true;
                    resolve(result);
                };
                tx.onerror = function () {
                    if (settled) return;
                    settled = true;
                    reject(tx.error);
                };
                tx.onabort = function () {
                    if (settled) return;
                    settled = true;
                    reject(tx.error || new Error("aborted"));
                };
                try {
                    Promise.resolve(fn(store))
                        .then(function (val) {
                            result = val;
                        })
                        .catch(function (err) {
                            try {
                                tx.abort();
                            } catch (e) {}
                            if (!settled) {
                                settled = true;
                                reject(err);
                            }
                        });
                } catch (err) {
                    if (!settled) {
                        settled = true;
                        reject(err);
                    }
                }
            });
        });
    }

    function assetKeyFromUrl(url) {
        try {
            var u = new URL(url, global.location.href);
            var scope = new URL("./", global.location.href);
            var path = decodeURIComponent(u.pathname);
            var base = scope.pathname || "/";
            if (!base.endsWith("/")) base += "/";
            if (path.indexOf(base) === 0) path = path.slice(base.length);
            return path.replace(/^\/+/, "");
        } catch (e) {
            return String(url || "").replace(/^\/+/, "");
        }
    }

    function guessType(key, headerType) {
        if (headerType && headerType.indexOf("text/html") === 0) return "text/html; charset=utf-8";
        if (headerType && headerType !== "application/octet-stream" && headerType.indexOf("charset") >= 0) {
            return headerType;
        }
        if (headerType && headerType !== "application/octet-stream" && !/octet-stream/i.test(headerType)) {
            // keep useful typed headers; still normalize js/css
        }
        var k = key.toLowerCase();
        if (k.endsWith(".html")) return "text/html; charset=utf-8";
        if (k.endsWith(".css")) return "text/css; charset=utf-8";
        if (k.endsWith(".js") || k.endsWith(".mjs") || k.endsWith(".cjs"))
            return "application/javascript; charset=utf-8";
        if (k.endsWith(".wasm")) return "application/wasm";
        if (k.endsWith(".json") || k.endsWith(".map")) return "application/json";
        if (k.endsWith(".svg")) return "image/svg+xml";
        if (k.endsWith(".png")) return "image/png";
        if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return "image/jpeg";
        if (k.endsWith(".gif")) return "image/gif";
        if (k.endsWith(".webp")) return "image/webp";
        if (k.endsWith(".ico")) return "image/x-icon";
        if (k.endsWith(".woff2")) return "font/woff2";
        if (k.endsWith(".woff")) return "font/woff";
        if (k.endsWith(".ttf")) return "font/ttf";
        if (k.endsWith(".otf")) return "font/otf";
        return headerType || "application/octet-stream";
    }

    function loadVisited() {
        try {
            var raw = global.localStorage.getItem(VISITED_KEY);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function saveVisited(ids) {
        try {
            global.localStorage.setItem(VISITED_KEY, JSON.stringify(ids.slice(0, 80)));
        } catch (e) {}
    }

    function rememberVisited(toolId) {
        if (!toolId) return;
        var ids = loadVisited();
        var idx = ids.indexOf(toolId);
        if (idx >= 0) ids.splice(idx, 1);
        ids.unshift(toolId);
        saveVisited(ids);
    }

    function markLocal(key) {
        if (!key) return;
        if (!state.localKeys[key]) {
            state.localKeys[key] = true;
            state.localCount += 1;
        }
    }

    function unmarkAllLocal() {
        state.localKeys = Object.create(null);
        state.localCount = 0;
    }

    function loadLocalKeyIndex() {
        return withStore("readonly", STORE, function (store) {
            if (typeof store.getAllKeys === "function") {
                return idbReq(store.getAllKeys());
            }
            return new Promise(function (resolve, reject) {
                var keys = [];
                var req = store.openCursor();
                req.onsuccess = function () {
                    var cursor = req.result;
                    if (cursor) {
                        keys.push(cursor.primaryKey);
                        cursor.continue();
                    } else {
                        resolve(keys);
                    }
                };
                req.onerror = function () {
                    reject(req.error);
                };
            });
        }).then(function (keys) {
            unmarkAllLocal();
            (keys || []).forEach(function (k) {
                state.localKeys[k] = true;
            });
            state.localCount = keys ? keys.length : 0;
            return state.localCount;
        });
    }

    function hasFileSync(key) {
        return !!state.localKeys[key];
    }

    function putFile(key, blob, contentType) {
        return withStore("readwrite", STORE, function (store) {
            return idbReq(
                store.put({
                    key: key,
                    blob: blob,
                    contentType: contentType,
                    size: blob && typeof blob.size === "number" ? blob.size : 0,
                    updatedAt: Date.now()
                })
            );
        }).then(function () {
            markLocal(key);
        });
    }

    function clearAllFiles() {
        return withStore("readwrite", STORE, function (store) {
            return idbReq(store.clear());
        }).then(function () {
            unmarkAllLocal();
        });
    }

    function addTarget(key) {
        if (!key || state.targets[key]) return false;
        state.targets[key] = true;
        state.targetCount += 1;
        if (hasFileSync(key)) state.doneCount += 1;
        return true;
    }

    function recountDone() {
        var n = 0;
        Object.keys(state.targets).forEach(function (key) {
            if (hasFileSync(key)) n += 1;
        });
        state.doneCount = n;
        return n;
    }

    /**
     * 只把「尚未落盘」的资源入队；已下载的只计入进度，不重新请求。
     */
    function enqueueKeys(keys) {
        if (!keys || !keys.length) return Promise.resolve();
        var missing = [];
        keys.forEach(function (key) {
            if (!key) return;
            addTarget(key);
            if (hasFileSync(key)) return;
            if (state.queuedSet[key]) return;
            state.queuedSet[key] = true;
            missing.push(key);
        });
        recountDone();
        missing.forEach(function (key) {
            state.queue.push(key);
        });
        emit();
        if (missing.length) schedulePump(0);
        return Promise.resolve();
    }

    function assetsForTool(tool) {
        var out = [];
        var seen = Object.create(null);
        function push(key) {
            if (!key || seen[key]) return;
            seen[key] = true;
            out.push(key);
        }
        var man = state.manifest;
        if (man && Array.isArray(man.shared)) man.shared.forEach(push);
        if (tool && tool.path && man && man.byPage && man.byPage[tool.path]) {
            man.byPage[tool.path].forEach(push);
        } else if (tool && tool.path) {
            // 清单缺失时至少拉工具页本身
            push(tool.path.split("?")[0]);
        }
        return out;
    }

    function pause(ms) {
        var until = Date.now() + (typeof ms === "number" ? ms : 2000);
        if (until > state.pauseUntil) state.pauseUntil = until;
    }

    function schedulePump(delay) {
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        state.timer = setTimeout(pump, typeof delay === "number" ? delay : state.gapMs);
    }

    function downloadOne(key) {
        if (hasFileSync(key)) return Promise.resolve(true);
        var url = new URL(key, global.location.href).href;
        return fetch(url, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        }).then(function (res) {
            if (!res || !res.ok) throw new Error("HTTP " + (res && res.status));
            var headerType = res.headers.get("content-type") || "";
            return res.blob().then(function (blob) {
                return putFile(key, blob, guessType(key, headerType));
            });
        });
    }

    function pump() {
        state.timer = null;
        if (!state.enabled || state.clearing) return;
        if (state.busy) return;
        if (!state.queue.length) {
            recountDone();
            emit();
            return;
        }
        if (global.document && global.document.hidden) {
            schedulePump(800);
            return;
        }
        var wait = state.pauseUntil - Date.now();
        if (wait > 0) {
            schedulePump(wait + 20);
            return;
        }

        var key = state.queue.shift();
        delete state.queuedSet[key];
        if (hasFileSync(key)) {
            recountDone();
            emit();
            if (state.queue.length) schedulePump(0);
            return;
        }

        state.busy = true;
        downloadOne(key)
            .then(function () {
                recountDone();
            })
            .catch(function () {
                if (!state.queuedSet[key] && !hasFileSync(key)) {
                    state.queuedSet[key] = true;
                    state.queue.push(key);
                }
            })
            .then(function () {
                state.busy = false;
                emit();
                if (state.queue.length) schedulePump(state.gapMs);
            });
    }

    function loadManifest() {
        return fetch(MANIFEST_URL, { cache: "no-store", credentials: "same-origin" })
            .then(function (res) {
                if (!res.ok) throw new Error("manifest " + res.status);
                return res.json();
            })
            .catch(function () {
                return { version: 0, shared: [], byPage: {} };
            });
    }

    /** 按 toolsList 顺序收集资源（与「全部工具页」从上往下一致）；shared 优先，清单孤儿页殿后 */
    function assetsForAll(toolsList) {
        var seen = Object.create(null);
        var keys = [];
        function push(key) {
            if (!key || seen[key]) return;
            seen[key] = true;
            keys.push(key);
        }
        var man = state.manifest || {};
        (man.shared || []).forEach(push);
        (toolsList || []).forEach(function (tool) {
            assetsForTool(tool).forEach(push);
        });
        if (man.byPage) {
            Object.keys(man.byPage).forEach(function (page) {
                (man.byPage[page] || []).forEach(push);
            });
        }
        return keys;
    }

    /**
     * 入队全部资源。preferTool 的文件排在最前，其后按 toolsList（全部工具页从上往下）顺序。
     * 已落盘的只计进度，不重新请求。
     */
    function enqueueAll(toolsList, preferTool) {
        var ordered = [];
        var seen = Object.create(null);
        function push(key) {
            if (!key || seen[key]) return;
            seen[key] = true;
            ordered.push(key);
        }
        if (preferTool) assetsForTool(preferTool).forEach(push);
        assetsForAll(toolsList).forEach(push);
        return enqueueKeys(ordered);
    }

    function enqueueTool(tool) {
        if (!state.enabled || !tool || !state.ready) return Promise.resolve(getSnapshot());
        rememberVisited(tool.id);
        // 全量已在 init 入队；这里只补当前工具，已下载的不会再请求
        return enqueueKeys(assetsForTool(tool)).then(function () {
            return getSnapshot();
        });
    }

    function clearAndRedownload(toolsList, preferToolId) {
        if (!state.enabled || state.clearing) return Promise.resolve(getSnapshot());
        state.clearing = true;
        state.queue = [];
        state.queuedSet = Object.create(null);
        state.targets = Object.create(null);
        state.targetCount = 0;
        state.doneCount = 0;
        state.busy = false;
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        if (preferToolId) rememberVisited(preferToolId);
        emit();
        return clearAllFiles()
            .then(function () {
                state.clearing = false;
                var prefer = null;
                (toolsList || []).some(function (t) {
                    if (t && t.id === preferToolId) {
                        prefer = t;
                        return true;
                    }
                    return false;
                });
                return enqueueAll(toolsList, prefer);
            })
            .catch(function () {
                state.clearing = false;
                emit();
            })
            .then(function () {
                return getSnapshot();
            });
    }

    function init(toolsList, preferTool) {
        state.enabled = canUseOffline();
        if (!state.enabled) {
            state.ready = true;
            emit();
            return Promise.resolve(getSnapshot());
        }
        return openDb()
            .then(function () {
                return loadManifest();
            })
            .then(function (man) {
                state.manifest = man || { shared: [], byPage: {} };
                return loadLocalKeyIndex();
            })
            .then(function () {
                state.ready = true;
                // 首次/刷新：后台下完全部工具；已有文件直接跳过
                return enqueueAll(toolsList || [], preferTool || null);
            })
            .then(function () {
                emit();
                return getSnapshot();
            })
            .catch(function () {
                state.ready = true;
                emit();
                return getSnapshot();
            });
    }

    function onChange(fn) {
        if (typeof fn === "function") state.listeners.push(fn);
        return function () {
            state.listeners = state.listeners.filter(function (x) {
                return x !== fn;
            });
        };
    }

    function bindUserPause() {
        if (!global.document) return;
        function onAct() {
            pause(300);
        }
        global.document.addEventListener("pointerdown", onAct, true);
        global.document.addEventListener("keydown", onAct, true);
    }

    bindUserPause();

    global.ToolOffline = {
        init: init,
        enqueueTool: enqueueTool,
        enqueueAll: enqueueAll,
        clearAndRedownload: clearAndRedownload,
        getSnapshot: getSnapshot,
        onChange: onChange,
        pause: pause,
        assetKeyFromUrl: assetKeyFromUrl,
        dbName: DB_NAME,
        storeName: STORE
    };
})(typeof window !== "undefined" ? window : self);
