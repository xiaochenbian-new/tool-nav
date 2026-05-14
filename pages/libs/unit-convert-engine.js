/* Unit conversion engine aligned with Ctool util.ts (mathjs + format). */
(function () {
    var G = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self;
    /* UMD 包 lib/browser/math.js 挂到 window.math；部分环境可能为 mathjs */
    var mathFactory = G.mathjs || G.math;
    if (!mathFactory || typeof mathFactory.create !== "function") {
        throw new Error("mathjs 未加载：请先执行 npm install（生成 vendor/mathjs/math.js）并在页面中引入该脚本。");
    }
    var math = mathFactory.create(mathFactory.all, { number: "BigNumber" });

    var MAX_NUM = 14;
    var DECIMAL_NUM = 7;
    var EXPONENTIAL_NUM = 4;

    function exponential(num, n) {
        var numExp = num.toExponential(n);
        return (numExp + "").match(new RegExp(".0\\{" + n + "\\}e")) ? num.toExponential(0) : numExp;
    }

    function format(_num) {
        var num = Number(_num);
        if (!isFinite(num)) {
            return String(_num);
        }
        var strNum = "" + num;
        var isFloat = false;
        var arr, intPart, decPart;
        if (strNum.indexOf(".") > -1) {
            var match = strNum.match(/\.\d+e[+-](\d+)$/);
            if (match && match[1]) {
                isFloat = match[1] * 1 < MAX_NUM - 1;
            } else {
                isFloat = true;
            }
        }
        if (isFloat) {
            if (num > -1 && num < 1 && num !== 0) {
                if (Math.abs(num) < 0.00001) {
                    return exponential(num, EXPONENTIAL_NUM);
                }
                num = Number(num.toFixed(DECIMAL_NUM));
            } else {
                arr = strNum.split(".");
                intPart = arr[0];
                decPart = arr[1];
                if (strNum.length > MAX_NUM) {
                    if (intPart.length >= MAX_NUM) {
                        return exponential(num, EXPONENTIAL_NUM);
                    }
                    if (intPart.length < DECIMAL_NUM - 1) {
                        num = Number(num.toFixed(DECIMAL_NUM));
                    } else {
                        num = Number(num.toFixed(MAX_NUM - intPart.length - 1));
                    }
                } else {
                    if (decPart && decPart.length > DECIMAL_NUM) {
                        num = Number(num.toFixed(DECIMAL_NUM));
                    }
                }
            }
        } else {
            if (strNum.length > MAX_NUM) {
                return exponential(num, EXPONENTIAL_NUM);
            }
        }
        return "" + num;
    }

    function getType(name) {
        var cfg = window.UnitConvertConfig;
        for (var i = 0; i < cfg.length; i++) {
            if (name === cfg[i].key) {
                return cfg[i];
            }
        }
        throw new Error(name + " type not found");
    }

    function getUnit(type, unitKey) {
        var t = getType(type);
        for (var i = 0; i < t.unit.length; i++) {
            if (unitKey === t.unit[i].key) {
                return t.unit[i];
            }
        }
        throw new Error(type + " - " + unitKey + " unit not found");
    }

    function getSpecial(name, from, to) {
        var type = getType(name);
        if (!type.special || type.special.length === 0) {
            return null;
        }
        for (var i = 0; i < type.special.length; i++) {
            var sp = type.special[i];
            if (sp.from === from && sp.to === to) {
                return sp.func;
            }
        }
        return null;
    }

    function getGroupByUnit(type, unit) {
        var t = getType(type);
        for (var g = 0; g < t.group.length; g++) {
            var group = t.group[g];
            if (group.list.indexOf(unit) !== -1) {
                return group.key;
            }
        }
        return "";
    }

    function calculate(type, numStr, from, to) {
        if (from === to) {
            return format(numStr);
        }
        var fromUnit = getUnit(type, from);
        var toUnit = getUnit(type, to);
        var special = getSpecial(type, from, to);

        function calc(input, expression) {
            var expr = expression.split("x").join(input);
            return math.evaluate(expr).toString();
        }

        var num = numStr;
        if (special !== null) {
            num = calc(num, special);
        } else {
            num = calc(calc(num, fromUnit.init), toUnit.calc);
        }
        return format(num);
    }

    window.UnitConvertEngine = {
        math: math,
        getType: getType,
        getUnit: getUnit,
        getGroupByUnit: getGroupByUnit,
        calculate: calculate,
        format: format,
    };
})();
