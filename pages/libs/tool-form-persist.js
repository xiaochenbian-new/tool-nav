/**
 * 工具页表单持久化：刷新后保留输入；带「清空」按钮的页面仅在点击清空时清除。
 * 在 index 的 iframe 内由父页注入并配合 ToolNavPersist；单独打开页面时自行读写 localStorage。
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

    function isInIframe() {
        try {
            return global.parent && global.parent !== global;
        } catch (e) {
            return true;
        }
    }

    function getToolId() {
        try {
            if (global.frameElement) {
                var frameId = global.frameElement.getAttribute("data-tool-id");
                if (frameId) return frameId;
            }
        } catch (e) {
            // cross-origin
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
        try {
            localStorage.setItem(getStorageKey(), JSON.stringify(collectFormData()));
        } catch (e) {
            // ignore
        }
    }

    function restoreFromLocal() {
        try {
            var raw = localStorage.getItem(getStorageKey());
            if (!raw) return false;
            return applyFormData(JSON.parse(raw));
        } catch (e) {
            return false;
        }
    }

    function clearLocal() {
        try {
            localStorage.removeItem(getStorageKey());
        } catch (e) {
            // ignore
        }
    }

    function parentPersist() {
        try {
            if (isInIframe() && global.parent.ToolNavPersist) {
                return global.parent.ToolNavPersist;
            }
        } catch (e) {
            // ignore
        }
        return null;
    }

    function scheduleSave() {
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(function () {
            var parentApi = parentPersist();
            if (parentApi && parentApi.saveCurrent) {
                parentApi.saveCurrent();
            } else {
                saveToLocal();
            }
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

    function scheduleRestoreHooks() {
        [0, 90, 220, 450].forEach(function (ms) {
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
                            var parentApi = parentPersist();
                            if (parentApi && parentApi.saveCurrent) {
                                parentApi.saveCurrent();
                            } else {
                                saveToLocal();
                            }
                        }, 0);
                        setTimeout(function () {
                            var parentApi = parentPersist();
                            if (parentApi && parentApi.saveCurrent) {
                                parentApi.saveCurrent();
                            } else {
                                saveToLocal();
                            }
                        }, 150);
                    });
            });
        });
    }

    function boot(opts) {
        if (booted) return;
        booted = true;
        opts = opts || {};
        document.documentElement.setAttribute("data-tool-persist-lib", "1");
        var inIframe = isInIframe();

        bindClearButtons();

        if (inIframe) {
            document.addEventListener("tool-nav:form-restored", runRestoreHooks);
            scheduleRestoreHooks();
            return;
        }

        bindAutosave();
        [0, 100, 280, 500].forEach(function (ms) {
            setTimeout(restoreFromLocal, ms);
        });
    }

    global.ToolFormPersist = {
        boot: boot,
        save: scheduleSave,
        saveNow: function () {
            var parentApi = parentPersist();
            if (parentApi && parentApi.saveCurrent) parentApi.saveCurrent();
            else saveToLocal();
        },
        restore: restoreFromLocal,
        clearStorage: clearLocal,
        getStorageKey: getStorageKey,
        collectFormData: collectFormData,
        applyFormData: applyFormData,
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            boot();
        });
    } else {
        boot();
    }
})(window);
