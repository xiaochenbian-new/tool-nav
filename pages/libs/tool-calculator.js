(function (global) {
    "use strict";

    var MAX_DIGITS = 16;
    var OP_SYMBOL = { "+": "+", "-": "−", "*": "×", "/": "÷" };

    function formatDisplay(num) {
        if (!isFinite(num)) return "溢出";
        if (Object.is(num, -0)) return "-0";
        var abs = Math.abs(num);
        if (abs !== 0 && (abs >= 1e16 || abs < 1e-10)) {
            return num.toExponential(10).replace(/\.?0+e/, "e").replace(/e\+/, "e");
        }
        var s = String(num);
        if (s.indexOf("e") !== -1 || s.indexOf("E") !== -1) {
            return num.toPrecision(12).replace(/\.?0+e/, "e").replace(/e\+/, "e");
        }
        if (s.indexOf(".") !== -1) {
            s = s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "").replace(/\.$/, "");
        }
        if (s.replace("-", "").replace(".", "").length > MAX_DIGITS) {
            return Number(num.toPrecision(12)).toString();
        }
        return s;
    }

    function parseDisplay(str) {
        if (str === "溢出" || str === "除数不能为0" || str === "无效输入") return NaN;
        var n = Number(str);
        return isFinite(n) ? n : NaN;
    }

    function applyBinary(a, op, b) {
        switch (op) {
            case "+": return a + b;
            case "-": return a - b;
            case "*": return a * b;
            case "/":
                if (b === 0) return NaN;
                return a / b;
            default: return b;
        }
    }

    function mount(root, options) {
        if (!root) return null;
        options = options || {};

        root.innerHTML =
            '<div class="tool-calc" tabindex="-1" role="application" aria-label="计算器">' +
            '  <input class="tool-calc-keytrap" data-role="keytrap" type="text" inputmode="decimal" lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" tabindex="0" aria-label="计算器键盘输入" />' +
            '  <div class="tool-calc-display">' +
            '    <div class="tool-calc-expr" data-role="expr" aria-live="polite"></div>' +
            '    <div class="tool-calc-value" data-role="value" aria-live="polite">0</div>' +
            "  </div>" +
            '  <div class="tool-calc-pad" data-role="pad">' +
            '    <button type="button" class="tool-calc-btn fn" data-action="percent" title="百分比 (%)" tabindex="-1">%</button>' +
            '    <button type="button" class="tool-calc-btn fn" data-action="ce" title="清除输入 (Delete)" tabindex="-1">CE</button>' +
            '    <button type="button" class="tool-calc-btn fn" data-action="c" title="清除 (C)" tabindex="-1">C</button>' +
            '    <button type="button" class="tool-calc-btn fn" data-action="backspace" title="退格 (Backspace)" tabindex="-1">⌫</button>' +
            '    <button type="button" class="tool-calc-btn fn" data-action="inv" title="倒数" tabindex="-1">¹⁄ₓ</button>' +
            '    <button type="button" class="tool-calc-btn fn" data-action="square" title="平方" tabindex="-1">x²</button>' +
            '    <button type="button" class="tool-calc-btn fn" data-action="sqrt" title="平方根" tabindex="-1">√x</button>' +
            '    <button type="button" class="tool-calc-btn op" data-action="op" data-op="/" title="除 (/)" tabindex="-1">÷</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="digit" data-digit="7" tabindex="-1">7</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="digit" data-digit="8" tabindex="-1">8</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="digit" data-digit="9" tabindex="-1">9</button>' +
            '    <button type="button" class="tool-calc-btn op" data-action="op" data-op="*" title="乘 (*)" tabindex="-1">×</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="digit" data-digit="4" tabindex="-1">4</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="digit" data-digit="5" tabindex="-1">5</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="digit" data-digit="6" tabindex="-1">6</button>' +
            '    <button type="button" class="tool-calc-btn op" data-action="op" data-op="-" title="减 (-)" tabindex="-1">−</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="digit" data-digit="1" tabindex="-1">1</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="digit" data-digit="2" tabindex="-1">2</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="digit" data-digit="3" tabindex="-1">3</button>' +
            '    <button type="button" class="tool-calc-btn op" data-action="op" data-op="+" title="加 (+)" tabindex="-1">+</button>' +
            '    <button type="button" class="tool-calc-btn fn" data-action="negate" title="正负 (F9)" tabindex="-1">±</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="digit" data-digit="0" tabindex="-1">0</button>' +
            '    <button type="button" class="tool-calc-btn digit" data-action="dot" title="小数点" tabindex="-1">.</button>' +
            '    <button type="button" class="tool-calc-btn eq" data-action="equals" title="等于 (Enter)" tabindex="-1">=</button>' +
            "  </div>" +
            '  <div class="tool-calc-hint">支持键盘：数字、+ − * /、Enter、C、Backspace、Delete</div>' +
            "</div>";

        var wrap = root.querySelector(".tool-calc");
        var keytrap = root.querySelector('[data-role="keytrap"]');
        var exprEl = root.querySelector('[data-role="expr"]');
        var valueEl = root.querySelector('[data-role="value"]');
        var padEl = root.querySelector('[data-role="pad"]');

        function resolveDigit(e) {
            var key = e && e.key != null ? String(e.key) : "";
            var code = e && e.code ? String(e.code) : "";
            var keyCode = e ? e.keyCode || e.which || 0 : 0;
            if (key >= "0" && key <= "9") return key;
            // 全角数字 ０-９
            if (key.length === 1) {
                var cw = key.charCodeAt(0);
                if (cw >= 0xff10 && cw <= 0xff19) {
                    return String.fromCharCode(cw - 0xff10 + 48);
                }
            }
            var m = /^Digit([0-9])$/.exec(code) || /^Numpad([0-9])$/.exec(code);
            if (m) {
                // Shift+数字产生符号时，key 是可打印非数字，不能按 code 当成数字
                if (
                    key.length === 1 &&
                    key !== "Process" &&
                    !(key >= "0" && key <= "9") &&
                    key.charCodeAt(0) < 0xff10
                ) {
                    return null;
                }
                // 含中文输入法 Process / Unidentified：用物理按键码识别数字
                return m[1];
            }
            if ((!key || key === "Unidentified" || key === "Process") && !e.shiftKey) {
                if (keyCode >= 48 && keyCode <= 57) return String(keyCode - 48);
                if (keyCode >= 96 && keyCode <= 105) return String(keyCode - 96);
            }
            return null;
        }

        function ingestChar(ch) {
            if (!ch) return false;
            var s = String(ch);
            if (s.length === 1) {
                var cw = s.charCodeAt(0);
                if (cw >= 0xff10 && cw <= 0xff19) {
                    s = String.fromCharCode(cw - 0xff10 + 48);
                }
            }
            if (s >= "0" && s <= "9") {
                inputDigit(s);
                flashButton('[data-digit="' + s + '"]');
                return true;
            }
            if (s === "." || s === "。") {
                inputDot();
                flashButton('[data-action="dot"]');
                return true;
            }
            if (s === "+" || s === "＋") {
                setOperator("+");
                flashButton('[data-op="+"]');
                return true;
            }
            if (s === "-" || s === "−" || s === "－") {
                setOperator("-");
                flashButton('[data-op="-"]');
                return true;
            }
            if (s === "*" || s === "×" || s === "＊" || s === "x" || s === "X") {
                setOperator("*");
                flashButton('[data-op="*"]');
                return true;
            }
            if (s === "/" || s === "÷" || s === "／") {
                setOperator("/");
                flashButton('[data-op="/"]');
                return true;
            }
            if (s === "=" || s === "＝") {
                equals();
                flashButton('[data-action="equals"]');
                return true;
            }
            if (s === "%") {
                percent();
                flashButton('[data-action="percent"]');
                return true;
            }
            if (s === "c" || s === "C") {
                clearAll();
                flashButton('[data-action="c"]');
                return true;
            }
            return false;
        }

        var state = {
            display: "0",
            expression: "",
            acc: null,
            pendingOp: null,
            waitingForOperand: false,
            lastOperand: null,
            lastOp: null,
            error: false,
            overwritten: false
        };

        function setError(msg) {
            state.error = true;
            state.display = msg;
            state.expression = "";
            state.acc = null;
            state.pendingOp = null;
            state.waitingForOperand = false;
            state.lastOperand = null;
            state.lastOp = null;
            state.overwritten = true;
            render();
        }

        function clearAll() {
            state.display = "0";
            state.expression = "";
            state.acc = null;
            state.pendingOp = null;
            state.waitingForOperand = false;
            state.lastOperand = null;
            state.lastOp = null;
            state.error = false;
            state.overwritten = false;
            render();
        }

        function clearEntry() {
            if (state.error) {
                clearAll();
                return;
            }
            state.display = "0";
            state.waitingForOperand = false;
            state.overwritten = false;
            render();
        }

        function render() {
            exprEl.textContent = state.expression || "";
            valueEl.textContent = state.display;
            valueEl.classList.toggle("is-error", !!state.error);
            var ops = padEl.querySelectorAll(".tool-calc-btn.op");
            for (var i = 0; i < ops.length; i++) {
                var btn = ops[i];
                var active = !state.error && state.pendingOp && btn.getAttribute("data-op") === state.pendingOp && state.waitingForOperand;
                btn.classList.toggle("is-active", !!active);
            }
        }

        function currentValue() {
            return parseDisplay(state.display);
        }

        function inputDigit(d) {
            if (state.error) clearAll();
            if (state.waitingForOperand || state.overwritten) {
                state.display = d;
                state.waitingForOperand = false;
                state.overwritten = false;
            } else {
                if (state.display === "0") {
                    state.display = d;
                } else if (state.display === "-0") {
                    state.display = "-" + d;
                } else {
                    var digits = state.display.replace("-", "").replace(".", "");
                    if (digits.length >= MAX_DIGITS) return;
                    state.display += d;
                }
            }
            render();
        }

        function inputDot() {
            if (state.error) clearAll();
            if (state.waitingForOperand || state.overwritten) {
                state.display = "0.";
                state.waitingForOperand = false;
                state.overwritten = false;
            } else if (state.display.indexOf(".") === -1) {
                state.display += ".";
            }
            render();
        }

        function backspace() {
            if (state.error) {
                clearAll();
                return;
            }
            if (state.waitingForOperand || state.overwritten) return;
            if (state.display.length <= 1 || (state.display.length === 2 && state.display.charAt(0) === "-")) {
                state.display = "0";
            } else {
                state.display = state.display.slice(0, -1);
            }
            render();
        }

        function negate() {
            if (state.error) return;
            if (state.waitingForOperand) {
                state.display = formatDisplay(-currentValue());
                state.waitingForOperand = false;
                state.overwritten = false;
            } else if (state.display.charAt(0) === "-") {
                state.display = state.display.slice(1);
            } else if (state.display !== "0") {
                state.display = "-" + state.display;
            } else {
                state.display = "-0";
            }
            render();
        }

        function commitPending() {
            var cur = currentValue();
            if (!isFinite(cur)) {
                setError("无效输入");
                return false;
            }
            if (state.acc == null || !state.pendingOp) {
                state.acc = cur;
                return true;
            }
            var result = applyBinary(state.acc, state.pendingOp, cur);
            if (!isFinite(result)) {
                if (state.pendingOp === "/" && cur === 0) {
                    setError("除数不能为0");
                } else {
                    setError("溢出");
                }
                return false;
            }
            state.acc = result;
            state.display = formatDisplay(result);
            return true;
        }

        function setOperator(op) {
            if (state.error) clearAll();
            var cur = currentValue();
            if (!isFinite(cur)) {
                setError("无效输入");
                return;
            }
            if (state.pendingOp && !state.waitingForOperand) {
                if (!commitPending()) return;
            } else if (state.acc == null) {
                state.acc = cur;
            }
            state.pendingOp = op;
            state.waitingForOperand = true;
            state.overwritten = false;
            state.lastOp = null;
            state.lastOperand = null;
            state.expression = formatDisplay(state.acc) + " " + (OP_SYMBOL[op] || op);
            render();
        }

        function equals() {
            if (state.error) return;
            var cur = currentValue();
            if (!isFinite(cur)) {
                setError("无效输入");
                return;
            }

            var op = state.pendingOp;
            var left = state.acc;
            var right = cur;

            if (op && left != null) {
                // normal: a op b =
            } else if (state.lastOp && state.lastOperand != null) {
                op = state.lastOp;
                left = cur;
                right = state.lastOperand;
            } else {
                state.expression = "";
                state.overwritten = true;
                render();
                return;
            }

            var result = applyBinary(left, op, right);
            if (!isFinite(result)) {
                if (op === "/" && right === 0) {
                    setError("除数不能为0");
                } else {
                    setError("溢出");
                }
                return;
            }

            state.expression =
                formatDisplay(left) + " " + (OP_SYMBOL[op] || op) + " " + formatDisplay(right) + " =";
            state.display = formatDisplay(result);
            state.acc = null;
            state.pendingOp = null;
            state.waitingForOperand = false;
            state.overwritten = true;
            state.lastOp = op;
            state.lastOperand = right;
            render();
        }

        function unary(kind) {
            if (state.error) clearAll();
            var cur = currentValue();
            if (!isFinite(cur)) {
                setError("无效输入");
                return;
            }
            var result;
            var label;
            switch (kind) {
                case "inv":
                    if (cur === 0) {
                        setError("除数不能为0");
                        return;
                    }
                    result = 1 / cur;
                    label = "1/(" + formatDisplay(cur) + ")";
                    break;
                case "square":
                    result = cur * cur;
                    label = "sqr(" + formatDisplay(cur) + ")";
                    break;
                case "sqrt":
                    if (cur < 0) {
                        setError("无效输入");
                        return;
                    }
                    result = Math.sqrt(cur);
                    label = "√(" + formatDisplay(cur) + ")";
                    break;
                default:
                    return;
            }
            if (!isFinite(result)) {
                setError("溢出");
                return;
            }
            state.expression = label;
            state.display = formatDisplay(result);
            state.waitingForOperand = false;
            state.overwritten = true;
            if (state.pendingOp == null) {
                state.acc = null;
            }
            render();
        }

        function percent() {
            if (state.error) return;
            var cur = currentValue();
            if (!isFinite(cur)) {
                setError("无效输入");
                return;
            }
            var result;
            if (state.acc != null && state.pendingOp) {
                // Windows-style: percent of accumulator for +/−, else cur/100
                if (state.pendingOp === "+" || state.pendingOp === "-") {
                    result = state.acc * (cur / 100);
                } else {
                    result = cur / 100;
                }
            } else {
                result = cur / 100;
            }
            if (!isFinite(result)) {
                setError("溢出");
                return;
            }
            state.display = formatDisplay(result);
            state.waitingForOperand = false;
            state.overwritten = false;
            render();
        }

        function flashButton(selector) {
            var btn = padEl.querySelector(selector);
            if (!btn) return;
            btn.classList.add("is-pressed");
            setTimeout(function () {
                btn.classList.remove("is-pressed");
            }, 90);
        }

        function handleAction(action, dataset) {
            switch (action) {
                case "digit":
                    inputDigit(dataset.digit);
                    break;
                case "dot":
                    inputDot();
                    break;
                case "op":
                    setOperator(dataset.op);
                    break;
                case "equals":
                    equals();
                    break;
                case "c":
                    clearAll();
                    break;
                case "ce":
                    clearEntry();
                    break;
                case "backspace":
                    backspace();
                    break;
                case "negate":
                    negate();
                    break;
                case "percent":
                    percent();
                    break;
                case "inv":
                    unary("inv");
                    break;
                case "square":
                    unary("square");
                    break;
                case "sqrt":
                    unary("sqrt");
                    break;
                default:
                    break;
            }
        }

        function focusKeytrap() {
            if (!keytrap || typeof keytrap.focus !== "function") return;
            try {
                keytrap.focus({ preventScroll: true });
            } catch (err) {
                keytrap.focus();
            }
        }

        padEl.addEventListener("click", function (e) {
            var btn = e.target && e.target.closest ? e.target.closest("[data-action]") : null;
            if (!btn || !padEl.contains(btn)) return;
            e.preventDefault();
            handleAction(btn.getAttribute("data-action"), {
                digit: btn.getAttribute("data-digit"),
                op: btn.getAttribute("data-op")
            });
            focusKeytrap();
        });

        function isEditableTarget(target) {
            if (!target || target.nodeType !== 1) return false;
            // 计算器内部 keytrap 不算外部输入框
            if (keytrap && (target === keytrap || keytrap.contains(target))) return false;
            if (wrap && wrap.contains(target)) return false;
            var tag = target.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
            if (target.isContentEditable) return true;
            return false;
        }

        function handleKeyDown(e) {
            if (!e) return false;
            if (typeof options.shouldHandleKeys === "function" && !options.shouldHandleKeys()) {
                return false;
            }
            // 外部输入框不拦截
            if (isEditableTarget(e.target)) {
                return false;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return false;

            // 中文输入法组合中：用 physical code 抓数字，避免候选数字被吃掉
            var digit = resolveDigit(e);
            var key = e.key;
            var code = e.code || "";
            var handled = true;

            if (digit != null) {
                inputDigit(digit);
                flashButton('[data-digit="' + digit + '"]');
            } else if (key === "." || key === "Decimal" || code === "NumpadDecimal" || key === "。") {
                inputDot();
                flashButton('[data-action="dot"]');
            } else if (key === "+" || key === "Add" || code === "NumpadAdd" || key === "＋") {
                setOperator("+");
                flashButton('[data-op="+"]');
            } else if (key === "-" || key === "Subtract" || code === "NumpadSubtract" || key === "−" || key === "－") {
                setOperator("-");
                flashButton('[data-op="-"]');
            } else if (key === "*" || key === "Multiply" || code === "NumpadMultiply" || key === "x" || key === "X" || key === "×") {
                setOperator("*");
                flashButton('[data-op="*"]');
            } else if (key === "/" || key === "Divide" || code === "NumpadDivide" || key === "÷") {
                setOperator("/");
                flashButton('[data-op="/"]');
            } else if (key === "Enter" || key === "=" || key === "NumpadEnter" || code === "NumpadEnter" || key === "＝") {
                equals();
                flashButton('[data-action="equals"]');
            } else if (key === "Delete" || key === "Clear") {
                clearEntry();
                flashButton('[data-action="ce"]');
            } else if (key === "Backspace") {
                backspace();
                flashButton('[data-action="backspace"]');
            } else if (key === "%") {
                percent();
                flashButton('[data-action="percent"]');
            } else if (key === "F9") {
                negate();
                flashButton('[data-action="negate"]');
            } else if (key === "c" || key === "C") {
                clearAll();
                flashButton('[data-action="c"]');
            } else if (e.isComposing || key === "Process") {
                // 组合中且无法解析为数字：交给 input/compositionend
                handled = false;
            } else {
                handled = false;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
                if (keytrap) keytrap.value = "";
            }
            return handled;
        }

        function onKeyDown(e) {
            handleKeyDown(e);
        }

        function flushKeytrapValue() {
            if (!keytrap) return;
            var v = keytrap.value;
            if (!v) return;
            keytrap.value = "";
            for (var i = 0; i < v.length; i++) {
                ingestChar(v.charAt(i));
            }
        }

        if (keytrap) {
            keytrap.addEventListener("keydown", onKeyDown, true);
            keytrap.addEventListener("input", function () {
                if (typeof options.shouldHandleKeys === "function" && !options.shouldHandleKeys()) {
                    keytrap.value = "";
                    return;
                }
                flushKeytrapValue();
            });
            keytrap.addEventListener("compositionend", function () {
                if (typeof options.shouldHandleKeys === "function" && !options.shouldHandleKeys()) {
                    keytrap.value = "";
                    return;
                }
                flushKeytrapValue();
            });
        }

        document.addEventListener("keydown", onKeyDown, true);

        render();

        return {
            clear: clearAll,
            handleKeyDown: handleKeyDown,
            focus: focusKeytrap,
            destroy: function () {
                document.removeEventListener("keydown", onKeyDown, true);
                root.innerHTML = "";
            },
            el: wrap
        };
    }

    global.ToolCalculator = {
        mount: mount
    };
})(typeof window !== "undefined" ? window : this);
