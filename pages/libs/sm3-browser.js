/**
 * SM3 摘要（源自 MIT 许可的 sm-crypto，供离线页面使用）
 * 全局：window.ctoolSm3Hex = { fromUtf8(str), fromBytes(Uint8Array) }
 */
(function (global) {
    "use strict";

    function rotl(x, n) {
        var result = [];
        var a = ~~(n / 8);
        var b = n % 8;
        for (var i = 0, len = x.length; i < len; i++) {
            result[i] = ((x[(i + a) % len] << b) & 0xff) + ((x[(i + a + 1) % len] >>> (8 - b)) & 0xff);
        }
        return result;
    }
    function xor(x, y) {
        var result = [];
        for (var i = x.length - 1; i >= 0; i--) result[i] = (x[i] ^ y[i]) & 0xff;
        return result;
    }
    function and(x, y) {
        var result = [];
        for (var i = x.length - 1; i >= 0; i--) result[i] = (x[i] & y[i]) & 0xff;
        return result;
    }
    function or(x, y) {
        var result = [];
        for (var i = x.length - 1; i >= 0; i--) result[i] = (x[i] | y[i]) & 0xff;
        return result;
    }
    function add(x, y) {
        var result = [];
        var temp = 0;
        for (var i = x.length - 1; i >= 0; i--) {
            var sum = x[i] + y[i] + temp;
            if (sum > 0xff) {
                temp = 1;
                result[i] = sum & 0xff;
            } else {
                temp = 0;
                result[i] = sum & 0xff;
            }
        }
        return result;
    }
    function not(x) {
        var result = [];
        for (var i = x.length - 1; i >= 0; i--) result[i] = (~x[i]) & 0xff;
        return result;
    }
    function P0(X) {
        return xor(xor(X, rotl(X, 9)), rotl(X, 17));
    }
    function P1(X) {
        return xor(xor(X, rotl(X, 15)), rotl(X, 23));
    }
    function FF(X, Y, Z, j) {
        return j >= 0 && j <= 15 ? xor(xor(X, Y), Z) : or(or(and(X, Y), and(X, Z)), and(Y, Z));
    }
    function GG(X, Y, Z, j) {
        return j >= 0 && j <= 15 ? xor(xor(X, Y), Z) : or(and(X, Y), and(not(X), Z));
    }
    function CF(V, Bi) {
        var W = [];
        var M = [];
        var i;
        for (i = 0; i < 16; i++) {
            var start = i * 4;
            W.push(Bi.slice(start, start + 4));
        }
        for (var j = 16; j < 68; j++) {
            W.push(xor(xor(P1(xor(xor(W[j - 16], W[j - 9]), rotl(W[j - 3], 15))), rotl(W[j - 13], 7)), W[j - 6]));
        }
        for (j = 0; j < 64; j++) {
            M.push(xor(W[j], W[j + 4]));
        }
        var T1 = [0x79, 0xcc, 0x45, 0x19];
        var T2 = [0x7a, 0x87, 0x9d, 0x8a];
        var A = V.slice(0, 4);
        var B = V.slice(4, 8);
        var C = V.slice(8, 12);
        var D = V.slice(12, 16);
        var E = V.slice(16, 20);
        var F = V.slice(20, 24);
        var G = V.slice(24, 28);
        var H = V.slice(28, 32);
        var SS1, SS2, TT1, TT2;
        for (j = 0; j < 64; j++) {
            var T = j >= 0 && j <= 15 ? T1 : T2;
            SS1 = rotl(add(add(rotl(A, 12), E), rotl(T, j)), 7);
            SS2 = xor(SS1, rotl(A, 12));
            TT1 = add(add(add(FF(A, B, C, j), D), SS2), M[j]);
            TT2 = add(add(add(GG(E, F, G, j), H), SS1), W[j]);
            D = C;
            C = rotl(B, 9);
            B = A;
            A = TT1;
            H = G;
            G = rotl(F, 19);
            F = E;
            E = P0(TT2);
        }
        return xor([].concat(A, B, C, D, E, F, G, H), V);
    }
    function sm3(array) {
        var len = array.length * 8;
        var k = len % 512;
        k = k >= 448 ? 512 - (k % 448) - 1 : 448 - k - 1;
        var kArr = new Array((k - 7) / 8);
        for (var i = 0, le = kArr.length; i < le; i++) kArr[i] = 0;
        var lenArr = [];
        var lenBits = len.toString(2);
        for (i = 7; i >= 0; i--) {
            if (lenBits.length > 8) {
                var start = lenBits.length - 8;
                lenArr[i] = parseInt(lenBits.substr(start), 2);
                lenBits = lenBits.substr(0, start);
            } else if (lenBits.length > 0) {
                lenArr[i] = parseInt(lenBits, 2);
                lenBits = "";
            } else {
                lenArr[i] = 0;
            }
        }
        var m = [].concat(array, [0x80], kArr, lenArr);
        var n = m.length / 64;
        var V = [
            0x73, 0x80, 0x16, 0x6f, 0x49, 0x14, 0xb2, 0xb9, 0x17, 0x24, 0x42, 0xd7, 0xda, 0x8a, 0x06, 0x00, 0xa9, 0x6f, 0x30, 0xbc, 0x16, 0x31, 0x38, 0xaa, 0xe3, 0x8d, 0xee, 0x4d, 0xb0, 0xfb, 0x0e, 0x4e,
        ];
        for (i = 0; i < n; i++) {
            var st = 64 * i;
            var B = m.slice(st, st + 64);
            V = CF(V, B);
        }
        return V;
    }

    function ArrayToHex(arr) {
        return arr
            .map(function (item) {
                item = item.toString(16);
                return item.length === 1 ? "0" + item : item;
            })
            .join("");
    }

    function utf8ToArray(str) {
        var arr = [];
        for (var i = 0, l = str.length; i < l; i++) {
            var point = str.codePointAt(i);
            if (point <= 0x007f) {
                arr.push(point);
            } else if (point <= 0x07ff) {
                arr.push(0xc0 | (point >>> 6));
                arr.push(0x80 | (point & 0x3f));
            } else if (point <= 0xd7ff || (point >= 0xe000 && point <= 0xffff)) {
                arr.push(0xe0 | (point >>> 12));
                arr.push(0x80 | ((point >>> 6) & 0x3f));
                arr.push(0x80 | (point & 0x3f));
            } else if (point >= 0x010000 && point <= 0x10ffff) {
                i++;
                arr.push((0xf0 | ((point >>> 18) & 0x1c)) >>> 0);
                arr.push((0x80 | ((point >>> 12) & 0x3f)) >>> 0);
                arr.push((0x80 | ((point >>> 6) & 0x3f)) >>> 0);
                arr.push((0x80 | (point & 0x3f)) >>> 0);
            } else {
                arr.push(point);
                throw new Error("input is not supported");
            }
        }
        return arr;
    }

    function bytesToNumArray(u8) {
        var a = [];
        for (var i = 0; i < u8.length; i++) a.push(u8[i]);
        return a;
    }

    global.ctoolSm3Hex = {
        fromUtf8: function (str) {
            return ArrayToHex(sm3(utf8ToArray(str)));
        },
        fromBytes: function (u8) {
            return ArrayToHex(sm3(bytesToNumArray(u8)));
        },
    };
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : this);
