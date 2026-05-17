/**
 * 工具页统一剪贴板复制与 Toast 提示
 * 用法：ToolCopy.copy(text) / ToolCopy.copy(text, { onLabelEl: btn })
 */
(function (global) {
    "use strict";

    var TOAST_ID = "tool-copy-toast";
    var DEFAULT_OK = "已复制到剪贴板";
    var DEFAULT_FAIL = "复制失败，请手动复制或检查浏览器权限";
    var DEFAULT_EMPTY = "无内容可复制";

    function ensureToastEl() {
        var el = document.getElementById(TOAST_ID);
        if (el) return el;
        if (!document.getElementById("tool-copy-style")) {
            var st = document.createElement("style");
            st.id = "tool-copy-style";
            st.textContent =
                "#" +
                TOAST_ID +
                "{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(12px);z-index:100000;padding:8px 16px;border-radius:8px;font-size:13px;line-height:1.4;color:#fff;background:rgba(31,42,68,.92);box-shadow:0 8px 24px rgba(36,90,190,.25);opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease;max-width:min(90vw,420px);text-align:center}" +
                "#" +
                TOAST_ID +
                ".show{opacity:1;transform:translateX(-50%) translateY(0)}";
            (document.head || document.documentElement).appendChild(st);
        }
        el = document.createElement("div");
        el.id = TOAST_ID;
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        document.body.appendChild(el);
        return el;
    }

    function toast(msg, durationMs) {
        var el = ensureToastEl();
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(function () {
            el.classList.remove("show");
        }, durationMs == null ? 2000 : durationMs);
    }

    function fallbackCopy(text) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand failed");
    }

    function flashLabel(el, labelText) {
        if (!el || !el.nodeType) return;
        var label = labelText != null ? labelText : el.textContent;
        el.textContent = "已复制";
        clearTimeout(el._copyFlashTimer);
        el._copyFlashTimer = setTimeout(function () {
            el.textContent = label;
        }, 1600);
    }

    /**
     * @param {string} text
     * @param {{ successMsg?: string, failMsg?: string, emptyMsg?: string, allowEmpty?: boolean, onLabelEl?: Element, labelText?: string, silent?: boolean }} [options]
     * @returns {Promise<boolean>}
     */
    function copy(text, options) {
        options = options || {};
        text = text == null ? "" : String(text);
        if (!text && !options.allowEmpty) {
            if (!options.silent) toast(options.emptyMsg || DEFAULT_EMPTY);
            return Promise.resolve(false);
        }

        function finish(ok) {
            if (!options.silent) {
                toast(ok ? options.successMsg || DEFAULT_OK : options.failMsg || DEFAULT_FAIL);
            }
            if (ok && options.onLabelEl) flashLabel(options.onLabelEl, options.labelText);
            return ok;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard
                .writeText(text)
                .then(function () {
                    return finish(true);
                })
                .catch(function () {
                    try {
                        fallbackCopy(text);
                        return finish(true);
                    } catch (e) {
                        return finish(false);
                    }
                });
        }
        try {
            fallbackCopy(text);
            return Promise.resolve(finish(true));
        } catch (e2) {
            return Promise.resolve(finish(false));
        }
    }

    global.ToolCopy = {
        copy: copy,
        toast: toast
    };
})(typeof window !== "undefined" ? window : this);
