/**
 * URL 编码：strict-uri-encode；解码：decode-uri-component。
 * https://github.com/kevva/strict-uri-encode / https://github.com/SamVerschueren/decode-uri-component
 */
(function (global) {
    "use strict";
    global.ctoolStrictUriEncode = function (str) {
        return encodeURIComponent(str).replace(/[!'()*]/g, function (x) {
            return "%" + x.charCodeAt(0).toString(16).toUpperCase();
        });
    };

    var token = "%[a-f0-9]{2}";
    var singleMatcher = new RegExp("(" + token + ")|([^%]+?)", "gi");
    var multiMatcher = new RegExp("(" + token + ")+", "gi");

    function decodeComponents(components, split) {
        try {
            return [decodeURIComponent(components.join(""))];
        } catch (e) {}
        if (components.length === 1) {
            return components;
        }
        split = split || 1;
        var left = components.slice(0, split);
        var right = components.slice(split);
        return Array.prototype.concat.call([], decodeComponents(left), decodeComponents(right));
    }

    function decode(input) {
        try {
            return decodeURIComponent(input);
        } catch (e) {
            var tokens = input.match(singleMatcher) || [];
            var i;
            for (i = 1; i < tokens.length; i++) {
                input = decodeComponents(tokens, i).join("");
                tokens = input.match(singleMatcher) || [];
            }
            return input;
        }
    }

    function customDecodeURIComponent(input) {
        var replaceMap = {
            "%FE%FF": "\uFFFD\uFFFD",
            "%FF%FE": "\uFFFD\uFFFD",
        };
        var match = multiMatcher.exec(input);
        while (match) {
            try {
                replaceMap[match[0]] = decodeURIComponent(match[0]);
            } catch (e) {
                var result = decode(match[0]);
                if (result !== match[0]) {
                    replaceMap[match[0]] = result;
                }
            }
            match = multiMatcher.exec(input);
        }
        replaceMap["%C2"] = "\uFFFD";
        var entries = Object.keys(replaceMap);
        for (var k = 0; k < entries.length; k++) {
            var key = entries[k];
            input = input.replace(new RegExp(key, "g"), replaceMap[key]);
        }
        return input;
    }

    global.ctoolDecodeUriComponent = function (encodedURI) {
        if (typeof encodedURI !== "string") {
            throw new TypeError("Expected `encodedURI` to be of type `string`, got `" + typeof encodedURI + "`");
        }
        try {
            return decodeURIComponent(encodedURI);
        } catch (e) {
            return customDecodeURIComponent(encodedURI);
        }
    };
})(typeof window !== "undefined" ? window : this);
