/**
 * tool-nav 物理下载（IndexedDB）
 * - 访问工具后后台下载该工具 JS/CSS（及 monaco/katex 整包）
 * - 优先走已下载本地文件；Service Worker 从 IDB 直接响应
 * - 无 Cache Storage 全量缓存
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
        /** @type {string[]} */
        queue: [],
        queuedSet: Object.create(null),
        /** target set for progress denominator */
        targets: Object.create(null),
        targetCount: 0,
        doneCount: 0,
        localCount: 0,
        busy: false,
        pauseUntil: 0,
        timer: null,
        gapMs: 120,
        clearing: false,
        listeners: []
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
        var pct = total > 0 ? Math.round((done / total) * 100) : 0;
        var downloading = state.busy || state.queue.length > 0;
        return {
            enabled: state.enabled,
            ready: state.ready,
            percent: pct,
            done: done,
            total: total,
            localCount: state.localCount,
            queueLeft: state.queue.length,
            downloading: downloading,
            complete: total > 0 && done >= total && !downloading
        };
    }

    function openDb() {
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
                resolve(req.result);
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

    function withStore(mode, storeName, fn) {
        return openDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(storeName, mode);
                var store = tx.objectStore(storeName);
                Promise.resolve(fn(store))
                    .then(function (val) {
                        tx.oncomplete = function () {
                            db.close();
                            resolve(val);
                        };
                        tx.onerror = function () {
                            db.close();
                            reject(tx.error);
                        };
                        tx.onabort = function () {
                            db.close();
                            reject(tx.error || new Error("aborted"));
                        };
                    })
                    .catch(function (err) {
                        try {
                            tx.abort();
                        } catch (e) {}
                        db.close();
                        reject(err);
                    });
            });
        });
    }

    function assetKeyFromUrl(url) {
        try {
            var u = new URL(url, global.location.href);
            var scope = new URL("./", global.location.href);
            var path = u.pathname;
            var base = scope.pathname;
            if (base && path.indexOf(base) === 0) {
                path = path.slice(base.length);
            }
            return path.replace(/^\/+/, "");
        } catch (e) {
            return String(url || "").replace(/^\/+/, "");
        }
    }

    function guessType(key, headerType) {
        if (headerType && headerType !== "application/octet-stream") return headerType;
        var k = key.toLowerCase();
        if (k.endsWith(".css")) return "text/css; charset=utf-8";
        if (k.endsWith(".js") || k.endsWith(".mjs") || k.endsWith(".cjs"))
            return "application/javascript; charset=utf-8";
        if (k.endsWith(".wasm")) return "application/wasm";
        if (k.endsWith(".json")) return "application/json";
        if (k.endsWith(".svg")) return "image/svg+xml";
        if (k.endsWith(".woff2")) return "font/woff2";
        if (k.endsWith(".woff")) return "font/woff";
        if (k.endsWith(".ttf")) return "font/ttf";
        if (k.endsWith(".otf")) return "font/otf";
        if (k.endsWith(".map")) return "application/json";
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

    function countLocalFiles() {
        return withStore("readonly", STORE, function (store) {
            return idbReq(store.count());
        });
    }

    function hasFile(key) {
        return withStore("readonly", STORE, function (store) {
            return idbReq(store.get(key)).then(function (row) {
                return !!(row && row.blob);
            });
        });
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
        });
    }

    function clearAllFiles() {
        return withStore("readwrite", STORE, function (store) {
            return idbReq(store.clear());
        });
    }

    function addTarget(key) {
        if (!key || state.targets[key]) return;
        state.targets[key] = true;
        state.targetCount += 1;
    }

    function enqueueKeys(keys) {
        if (!keys || !keys.length) return;
        keys.forEach(function (key) {
            if (!key) return;
            addTarget(key);
            if (state.queuedSet[key]) return;
            state.queuedSet[key] = true;
            state.queue.push(key);
        });
        emit();
        schedulePump(0);
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
        if (man && Array.isArray(man.shared)) {
            man.shared.forEach(push);
        }
        if (tool && tool.path && man && man.byPage && man.byPage[tool.path]) {
            man.byPage[tool.path].forEach(push);
        }
        return out;
    }

    function refreshDoneCount() {
        var keys = Object.keys(state.targets);
        if (!keys.length) {
            state.doneCount = 0;
            return Promise.resolve(0);
        }
        return withStore("readonly", STORE, function (store) {
            return Promise.all(
                keys.map(function (key) {
                    return idbReq(store.get(key)).then(function (row) {
                        return row && row.blob ? 1 : 0;
                    });
                })
            ).then(function (flags) {
                var n = 0;
                flags.forEach(function (f) {
                    n += f;
                });
                state.doneCount = n;
                return n;
            });
        });
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
        return hasFile(key).then(function (exists) {
            if (exists) return true;
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
        });
    }

    function pump() {
        state.timer = null;
        if (!state.enabled || state.clearing) return;
        if (state.busy) return;
        if (!state.queue.length) {
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
        state.busy = true;

        downloadOne(key)
            .then(function () {
                return refreshDoneCount().then(function () {
                    return countLocalFiles();
                });
            })
            .then(function (n) {
                state.localCount = n;
            })
            .catch(function () {
                // 失败稍后重试一次
                if (!state.queuedSet[key]) {
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

    function enqueueTool(tool) {
        if (!state.enabled || !tool) return;
        rememberVisited(tool.id);
        enqueueKeys(assetsForTool(tool));
        refreshDoneCount().then(emit);
    }

    function requeueVisited(toolsList) {
        var visited = loadVisited();
        var map = Object.create(null);
        (toolsList || []).forEach(function (t) {
            if (t && t.id) map[t.id] = t;
        });
        var keys = [];
        var seen = Object.create(null);
        function pushAll(arr) {
            (arr || []).forEach(function (k) {
                if (!k || seen[k]) return;
                seen[k] = true;
                keys.push(k);
            });
        }
        if (state.manifest && state.manifest.shared) pushAll(state.manifest.shared);
        visited.forEach(function (id) {
            pushAll(assetsForTool(map[id]));
        });
        enqueueKeys(keys);
        return refreshDoneCount().then(emit);
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
                state.localCount = 0;
                state.clearing = false;
                return requeueVisited(toolsList);
            })
            .catch(function () {
                state.clearing = false;
                emit();
            })
            .then(function () {
                return getSnapshot();
            });
    }

    function init() {
        state.enabled = canUseOffline();
        if (!state.enabled) {
            state.ready = true;
            emit();
            return Promise.resolve(getSnapshot());
        }
        return loadManifest()
            .then(function (man) {
                state.manifest = man || { shared: [], byPage: {} };
                return countLocalFiles();
            })
            .then(function (n) {
                state.localCount = n;
                state.ready = true;
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
            pause(1800);
        }
        global.document.addEventListener("pointerdown", onAct, true);
        global.document.addEventListener("keydown", onAct, true);
    }

    bindUserPause();

    global.ToolOffline = {
        init: init,
        enqueueTool: enqueueTool,
        clearAndRedownload: clearAndRedownload,
        requeueVisited: requeueVisited,
        getSnapshot: getSnapshot,
        onChange: onChange,
        pause: pause,
        assetKeyFromUrl: assetKeyFromUrl,
        dbName: DB_NAME,
        storeName: STORE
    };
})(typeof window !== "undefined" ? window : self);
