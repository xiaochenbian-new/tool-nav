/**
 * jwt-decode@4.0.0 核心逻辑，浏览器 IIFE。
 */
(function (global) {
    "use strict";
    function InvalidTokenError(message) {
        this.message = message;
        this.name = "InvalidTokenError";
    }
    InvalidTokenError.prototype = Object.create(Error.prototype);

    function b64DecodeUnicode(str) {
        return decodeURIComponent(
            atob(str).replace(/(.)/g, function (m, p) {
                var code = p.charCodeAt(0).toString(16).toUpperCase();
                if (code.length < 2) {
                    code = "0" + code;
                }
                return "%" + code;
            }),
        );
    }

    function base64UrlDecode(str) {
        var output = str.replace(/-/g, "+").replace(/_/g, "/");
        switch (output.length % 4) {
            case 0:
                break;
            case 2:
                output += "==";
                break;
            case 3:
                output += "=";
                break;
            default:
                throw new Error("base64 string is not of the correct length");
        }
        try {
            return b64DecodeUnicode(output);
        } catch (err) {
            return atob(output);
        }
    }

    global.jwtDecode = function (token, options) {
        if (typeof token !== "string") {
            throw new InvalidTokenError("Invalid token specified: must be a string");
        }
        options = options || {};
        var pos = options.header === true ? 0 : 1;
        var part = token.split(".")[pos];
        if (typeof part !== "string") {
            throw new InvalidTokenError("Invalid token specified: missing part #" + (pos + 1));
        }
        var decoded;
        try {
            decoded = base64UrlDecode(part);
        } catch (e) {
            throw new InvalidTokenError("Invalid token specified: invalid base64 for part #" + (pos + 1) + " (" + e.message + ")");
        }
        try {
            return JSON.parse(decoded);
        } catch (e) {
            throw new InvalidTokenError("Invalid token specified: invalid json for part #" + (pos + 1) + " (" + e.message + ")");
        }
    };
    global.InvalidTokenError = InvalidTokenError;
})(typeof window !== "undefined" ? window : this);
