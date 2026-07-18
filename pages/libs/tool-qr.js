/**
 * 工具页悬浮二维码（依赖 qrcode-lib.bundle.js 的 QRCodeLib）
 * 用法：ToolQr.toggle(text, anchorEl) / ToolQr.hide()
 */
(function (global) {
    "use strict";

    var POPOVER_ID = "tool-qr-popover";
    var STYLE_ID = "tool-qr-style";
    var MAX_QR_CHUNKS = 120;
    var DEFAULT_SIZE = 220;
    var teEnc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    var teDec = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { fatal: true }) : null;
    var teDecLenient =
        typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { fatal: false }) : null;

    var state = {
        anchor: null,
        onDocClick: null
    };

    function toast(msg) {
        if (global.ToolCopy && global.ToolCopy.toast) {
            global.ToolCopy.toast(msg);
            return;
        }
        alert(msg);
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        var st = document.createElement("style");
        st.id = STYLE_ID;
        st.textContent =
            "#" +
            POPOVER_ID +
            "{position:fixed;z-index:100001;min-width:180px;max-width:min(92vw,360px);padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #dbe6ff;box-shadow:0 12px 32px rgba(36,90,190,.18);opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity .18s ease,transform .18s ease}" +
            "#" +
            POPOVER_ID +
            ".show{opacity:1;transform:translateY(0);pointer-events:auto}" +
            "#" +
            POPOVER_ID +
            " .tool-qr-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:12px;color:#6f7d96}" +
            "#" +
            POPOVER_ID +
            " .tool-qr-close{border:0;background:transparent;color:#6f7d96;font-size:18px;line-height:1;cursor:pointer;padding:0 2px}" +
            "#" +
            POPOVER_ID +
            " .tool-qr-close:hover{color:#2f6bff}" +
            "#" +
            POPOVER_ID +
            " .tool-qr-body{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-height:min(60vh,420px);overflow:auto}" +
            "#" +
            POPOVER_ID +
            " .tool-qr-item{display:flex;flex-direction:column;align-items:center;gap:4px}" +
            "#" +
            POPOVER_ID +
            " .tool-qr-item-label{font-size:11px;color:#6f7d96}" +
            "#" +
            POPOVER_ID +
            " canvas,#" +
            POPOVER_ID +
            " img{display:block;border-radius:4px}";
        (document.head || document.documentElement).appendChild(st);
    }

    function ensurePopover() {
        ensureStyle();
        var el = document.getElementById(POPOVER_ID);
        if (el) return el;
        el = document.createElement("div");
        el.id = POPOVER_ID;
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-label", "二维码");
        el.innerHTML =
            '<div class="tool-qr-head"><span class="tool-qr-title">扫码查看内容</span><button type="button" class="tool-qr-close" aria-label="关闭">&times;</button></div><div class="tool-qr-body"></div>';
        document.body.appendChild(el);
        el.querySelector(".tool-qr-close").addEventListener("click", hide);
        return el;
    }

    function qrCreateOk(text, ecc) {
        if (typeof QRCodeLib === "undefined" || !QRCodeLib.create) return false;
        try {
            QRCodeLib.create(String(text || ""), { errorCorrectionLevel: ecc });
            return true;
        } catch (e) {
            return false;
        }
    }

    function utf8CharEndExclusive(u8, pos) {
        if (pos >= u8.length) return pos;
        var c0 = u8[pos];
        if (c0 < 0x80) return pos + 1;
        if ((c0 & 0xe0) === 0xc0) return pos + 2 <= u8.length ? pos + 2 : u8.length;
        if ((c0 & 0xf0) === 0xe0) return pos + 3 <= u8.length ? pos + 3 : u8.length;
        if ((c0 & 0xf8) === 0xf0) return pos + 4 <= u8.length ? pos + 4 : u8.length;
        return pos + 1;
    }

    function splitUtf8ByQrCreate(text, ecc) {
        if (!teEnc || !teDec || !teDecLenient) return [String(text || "")];
        var u8 = teEnc.encode(text);
        if (u8.length === 0) return [];
        var out = [];
        var start = 0;
        while (start < u8.length) {
            var ends = [];
            var p = start;
            while (p < u8.length) {
                var nx = utf8CharEndExclusive(u8, p);
                if (nx <= p) nx = Math.min(p + 1, u8.length);
                ends.push(nx);
                p = nx;
            }
            var lo = 0;
            var hi = ends.length - 1;
            var best = -1;
            while (lo <= hi) {
                var mid = (lo + hi) >> 1;
                var endByte = ends[mid];
                var sliceStr;
                try {
                    sliceStr = teDec.decode(u8.subarray(start, endByte));
                } catch (e) {
                    hi = mid - 1;
                    continue;
                }
                if (qrCreateOk(sliceStr, ecc)) {
                    best = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
            if (best < 0) {
                throw new Error("内容过长，无法生成二维码");
            }
            var cut = ends[best];
            out.push(teDecLenient.decode(u8.subarray(start, cut)));
            start = cut;
        }
        return out;
    }

    function renderChunk(el, text, ecc, size) {
        var names = ["L", "M", "Q", "H"];
        var pref = names.indexOf((ecc || "L").toUpperCase());
        if (pref < 0) pref = 0;
        var order = [];
        for (var i = 0; i < names.length; i++) order.push(names[(pref + i) % names.length]);
        var lastErr = null;
        for (var j = 0; j < order.length; j++) {
            var nm = order[j];
            if (!qrCreateOk(text, nm)) {
                lastErr = new Error("该段内容过长");
                continue;
            }
            el.innerHTML = "";
            var canvas = document.createElement("canvas");
            var err = null;
            try {
                QRCodeLib.toCanvas(
                    canvas,
                    text,
                    {
                        errorCorrectionLevel: nm,
                        width: size,
                        margin: 2,
                        color: { dark: "#000000", light: "#ffffff" }
                    },
                    function (e) {
                        err = e;
                    }
                );
            } catch (e2) {
                err = e2;
            }
            if (err) {
                lastErr = err;
                continue;
            }
            el.appendChild(canvas);
            return nm;
        }
        throw lastErr || new Error("无法生成二维码");
    }

    function buildQrBody(bodyEl, text, size) {
        bodyEl.innerHTML = "";
        if (typeof QRCodeLib === "undefined" || !QRCodeLib.create) {
            throw new Error("二维码引擎未加载");
        }
        var chunks = splitUtf8ByQrCreate(text, "L");
        if (chunks.length > MAX_QR_CHUNKS) {
            throw new Error("内容过长，分片超过 " + MAX_QR_CHUNKS + " 张");
        }
        chunks.forEach(function (chunk, idx) {
            var item = document.createElement("div");
            item.className = "tool-qr-item";
            if (chunks.length > 1) {
                var label = document.createElement("div");
                label.className = "tool-qr-item-label";
                label.textContent = "第 " + (idx + 1) + " / " + chunks.length + " 张";
                item.appendChild(label);
            }
            var wrap = document.createElement("div");
            item.appendChild(wrap);
            bodyEl.appendChild(item);
            renderChunk(wrap, chunk, "L", size);
        });
        return chunks.length;
    }

    function positionPopover(pop, anchorEl) {
        var rect = anchorEl.getBoundingClientRect();
        var margin = 8;
        pop.style.left = "0";
        pop.style.top = "0";
        pop.classList.add("show");
        var popRect = pop.getBoundingClientRect();
        var left = rect.left + rect.width / 2 - popRect.width / 2;
        var top = rect.bottom + margin;
        if (left + popRect.width > window.innerWidth - margin) {
            left = window.innerWidth - popRect.width - margin;
        }
        if (left < margin) left = margin;
        if (top + popRect.height > window.innerHeight - margin) {
            top = rect.top - popRect.height - margin;
        }
        if (top < margin) top = margin;
        pop.style.left = Math.round(left) + "px";
        pop.style.top = Math.round(top) + "px";
    }

    function unbindOutsideClick() {
        if (state.onDocClick) {
            document.removeEventListener("mousedown", state.onDocClick);
            state.onDocClick = null;
        }
    }

    function hide() {
        var pop = document.getElementById(POPOVER_ID);
        if (pop) {
            pop.classList.remove("show");
            pop.querySelector(".tool-qr-body").innerHTML = "";
        }
        state.anchor = null;
        unbindOutsideClick();
    }

    function bindOutsideClick(pop, anchorEl) {
        unbindOutsideClick();
        state.onDocClick = function (e) {
            if (pop.contains(e.target) || anchorEl.contains(e.target)) return;
            hide();
        };
        setTimeout(function () {
            document.addEventListener("mousedown", state.onDocClick);
        }, 0);
    }

    /**
     * @param {string} text
     * @param {Element} anchorEl
     * @param {{ size?: number }} [options]
     */
    function show(text, anchorEl, options) {
        options = options || {};
        text = text == null ? "" : String(text);
        if (!text.trim()) {
            toast("无内容可生成二维码");
            return false;
        }
        if (!anchorEl || !anchorEl.nodeType) return false;

        var pop = ensurePopover();
        if (state.anchor === anchorEl && pop.classList.contains("show")) {
            hide();
            return false;
        }

        hide();
        state.anchor = anchorEl;

        try {
            var count = buildQrBody(pop.querySelector(".tool-qr-body"), text, options.size || DEFAULT_SIZE);
            var title = pop.querySelector(".tool-qr-title");
            if (title) {
                title.textContent = count > 1 ? "扫码查看内容（共 " + count + " 张）" : "扫码查看内容";
            }
            positionPopover(pop, anchorEl);
            bindOutsideClick(pop, anchorEl);
            return true;
        } catch (e) {
            hide();
            toast(e && e.message ? e.message : "二维码生成失败");
            return false;
        }
    }

    function toggle(text, anchorEl, options) {
        var pop = document.getElementById(POPOVER_ID);
        if (state.anchor === anchorEl && pop && pop.classList.contains("show")) {
            hide();
            return false;
        }
        return show(text, anchorEl, options);
    }

    global.ToolQr = {
        show: show,
        hide: hide,
        toggle: toggle
    };
})(typeof window !== "undefined" ? window : this);
