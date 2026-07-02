/**
 * 工具页表单持久化：刷新后保留输入；带「清空」按钮的页面仅在点击清空时清除。
 * 支持 file:// 离线包（iframe 跨域时由子页自行读写 localStorage）。
 */
(function (global) {
    var STORAGE_PREFIX = "tool_form_data_";
    var CLEAR_SELECTORS = [
        "#clear-btn",
        "#clearBtn",
        "#btn-clear",
        "#btnClear",
        "#clear-all-btn",
        "#ts-clear",
        "#tz-clear-all",
        "#btn-clear-in",
        "#clear-conn-btn",
        "#clear-src",
        "[data-tool-form-clear]",
    ];
    var autosaveTimer = null;
    var booted = false;
    var storageBackend = null;

    function isInIframe() {
        try {
            return global.parent && global.parent !== global;
        } catch (e) {
            return true;
        }
    }

    function getStorageBackend() {
        if (storageBackend) return storageBackend;
        try {
            var probe = "__tool_nav_persist_probe__";
            global.localStorage.setItem(probe, "1");
            global.localStorage.removeItem(probe);
            storageBackend = global.localStorage;
            return storageBackend;
        } catch (e) {
            // file:// 或隐私模式下 localStorage 可能不可用
        }
        try {
            storageBackend = global.sessionStorage;
            return storageBackend;
        } catch (e2) {
            storageBackend = null;
            return null;
        }
    }

    function getToolIdFromQuery() {
        try {
            var search = global.location && global.location.search ? global.location.search : "";
            var m = search.match(/(?:\?|&)_toolNavId=([^&]+)/);
            if (m && m[1]) return decodeURIComponent(m[1]);
        } catch (e) {
            // ignore
        }
        return "";
    }

    function getToolId() {
        var fromQuery = getToolIdFromQuery();
        if (fromQuery) return fromQuery;
        try {
            if (global.frameElement) {
                var frameId = global.frameElement.getAttribute("data-tool-id");
                if (frameId) return frameId;
            }
        } catch (e) {
            // cross-origin iframe
        }
        var path = (global.location && global.location.pathname) || "";
        var name = path.split("/").pop() || "tool";
        return "page_" + name.replace(/\.html$/i, "");
    }

    function getStorageKey() {
        return STORAGE_PREFIX + getToolId();
    }

    function getFieldKey(field, idx) {
        if (!field) return "";
        var direct = field.name || field.id || field.getAttribute("data-persist-key");
        if (direct) return direct;
        var fallback = "auto_" + field.tagName.toLowerCase() + "_" + idx;
        field.setAttribute("data-persist-key", fallback);
        return fallback;
    }

    function collectFormData() {
        var data = {};
        var fields = document.querySelectorAll("input, textarea, select");
        fields.forEach(function (field, idx) {
            if (field.type === "file") return;
            var key = getFieldKey(field, idx);
            if (!key) return;
            if (field.type === "checkbox" || field.type === "radio") {
                data[key] = !!field.checked;
            } else {
                data[key] = field.value;
            }
        });
        return data;
    }

    function applyFormData(data) {
        if (!data || typeof data !== "object") return false;
        var fields = document.querySelectorAll("input, textarea, select");
        fields.forEach(function (field, idx) {
            if (field.type === "file") return;
            var key = getFieldKey(field, idx);
            if (!key || data[key] === undefined) return;
            try {
                if (field.type === "checkbox" || field.type === "radio") {
                    field.checked = !!data[key];
                } else {
                    field.value = data[key];
                }
            } catch (e) {
                // skip field
            }
        });
        fields.forEach(function (field) {
            if (field.type === "file") return;
            try {
                field.dispatchEvent(new Event("input", { bubbles: true }));
                field.dispatchEvent(new Event("change", { bubbles: true }));
            } catch (e) {
                // ignore
            }
        });
        runRestoreHooks();
        try {
            document.dispatchEvent(
                new CustomEvent("tool-nav:form-restored", { bubbles: true, detail: { data: data } })
            );
        } catch (e) {
            // ignore
        }
        return true;
    }

    function saveToLocal() {
        var store = getStorageBackend();
        if (!store) return;
        try {
            store.setItem(getStorageKey(), JSON.stringify(collectFormData()));
        } catch (e) {
            // ignore
        }
        notifyParentSave();
    }

    function restoreFromLocal() {
        var store = getStorageBackend();
        if (!store) return false;
        try {
            var raw = store.getItem(getStorageKey());
            if (!raw) return false;
            return applyFormData(JSON.parse(raw));
        } catch (e) {
            return false;
        }
    }

    function clearLocal() {
        var store = getStorageBackend();
        if (!store) return;
        try {
            store.removeItem(getStorageKey());
        } catch (e) {
            // ignore
        }
        notifyParentSave();
    }

    function canParentAccessFrame() {
        try {
            if (!isInIframe()) return false;
            if (!global.parent || global.parent === global) return false;
            if (!global.parent.ToolNavPersist) return false;
            if (global.frameElement) return true;
            return false;
        } catch (e) {
            return false;
        }
    }

    function notifyParentSave() {
        try {
            if (!isInIframe() || !global.parent) return;
            global.parent.postMessage(
                {
                    type: "tool-nav-persist-save",
                    toolId: getToolId(),
                    data: collectFormData(),
                },
                "*"
            );
        } catch (e) {
            // ignore
        }
    }

    function tryParentSave() {
        if (!canParentAccessFrame()) return false;
        try {
            global.parent.ToolNavPersist.saveCurrent();
            return true;
        } catch (e) {
            return false;
        }
    }

    function scheduleSave() {
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(function () {
            saveToLocal();
            tryParentSave();
        }, 120);
    }

    function runRestoreHooks() {
        var names = ["toolNavRestoreForm", "__toolNavRestoreForm"];
        for (var i = 0; i < names.length; i++) {
            if (typeof global[names[i]] === "function") {
                try {
                    global[names[i]]();
                } catch (e) {
                    // ignore
                }
            }
        }
    }

    function scheduleRestoreFromLocal() {
        [0, 80, 200, 450, 800].forEach(function (ms) {
            setTimeout(restoreFromLocal, ms);
        });
        scheduleRestoreHooks();
    }

    function scheduleRestoreHooks() {
        [0, 90, 220, 450, 800].forEach(function (ms) {
            setTimeout(runRestoreHooks, ms);
        });
    }

    function bindAutosave() {
        if (document.documentElement.getAttribute("data-tool-persist-autosave") === "1") return;
        document.documentElement.setAttribute("data-tool-persist-autosave", "1");
        document.addEventListener(
            "input",
            function (e) {
                var tag = (e.target && e.target.tagName) || "";
                if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
                    scheduleSave();
                }
            },
            true
        );
        document.addEventListener(
            "change",
            function (e) {
                var tag = (e.target && e.target.tagName) || "";
                if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
                    scheduleSave();
                }
            },
            true
        );
    }

    function bindClearButtons() {
        if (document.documentElement.getAttribute("data-tool-persist-clear") === "1") return;
        document.documentElement.setAttribute("data-tool-persist-clear", "1");
        CLEAR_SELECTORS.forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (btn) {
                if (btn.getAttribute("data-tool-persist-bound") === "1") return;
                btn.setAttribute("data-tool-persist-bound", "1");
                btn.addEventListener("click", function () {
                    setTimeout(function () {
                        saveToLocal();
                        tryParentSave();
                    }, 0);
                    setTimeout(function () {
                        saveToLocal();
                        tryParentSave();
                    }, 150);
                });
            });
        });
    }

    function bindPageHideSave() {
        if (document.documentElement.getAttribute("data-tool-persist-pagehide") === "1") return;
        document.documentElement.setAttribute("data-tool-persist-pagehide", "1");
        global.addEventListener("pagehide", function () {
            saveToLocal();
            tryParentSave();
        });
    }

    function boot() {
        if (booted) return;
        booted = true;
        document.documentElement.setAttribute("data-tool-persist-lib", "1");

        bindClearButtons();
        bindAutosave();
        bindPageHideSave();
        scheduleRestoreFromLocal();

        document.addEventListener("tool-nav:form-restored", runRestoreHooks);

        global.addEventListener("message", function (event) {
            var data = event && event.data;
            if (!data || data.type !== "tool-nav-persist-restore-data") return;
            if (data.toolId && data.toolId !== getToolId()) return;
            try {
                applyFormData(data.data);
            } catch (e) {
                // ignore
            }
        });

        if (isInIframe()) {
            try {
                global.parent.postMessage(
                    { type: "tool-nav-persist-restore", toolId: getToolId() },
                    "*"
                );
            } catch (e) {
                // ignore
            }
        }
    }

    global.ToolFormPersist = {
        boot: boot,
        save: scheduleSave,
        saveNow: function () {
            saveToLocal();
            tryParentSave();
        },
        restore: restoreFromLocal,
        clearStorage: clearLocal,
        getStorageKey: getStorageKey,
        collectFormData: collectFormData,
        applyFormData: applyFormData,
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})(window);
