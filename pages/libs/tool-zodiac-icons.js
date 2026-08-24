(function (global) {
    "use strict";

    function bannerSvg(id, char, bodyPaths, accent) {
        accent = accent || "#c62828";
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 100" role="img">' +
            "<defs>" +
            '<linearGradient id="bg-' +
            id +
            '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#fffaf0"/>' +
            '<stop offset="55%" stop-color="#fff3e0"/>' +
            '<stop offset="100%" stop-color="#ffe0b2"/>' +
            "</linearGradient>" +
            '<linearGradient id="bar-' +
            id +
            '" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0%" stop-color="#e53935"/>' +
            '<stop offset="100%" stop-color="#b71c1c"/>' +
            "</linearGradient>" +
            "</defs>" +
            '<rect x="1" y="1" width="358" height="98" rx="10" fill="url(#bg-' +
            id +
            ')" stroke="' +
            accent +
            '" stroke-width="2"/>' +
            '<rect x="1" y="1" width="358" height="16" rx="10" fill="url(#bar-' +
            id +
            ')"/>' +
            '<rect x="1" y="9" width="358" height="8" fill="url(#bar-' +
            id +
            ')"/>' +
            '<circle cx="28" cy="50" r="18" fill="#ffecb3" opacity="0.65"/>' +
            '<circle cx="332" cy="50" r="18" fill="#ffecb3" opacity="0.65"/>' +
            '<path d="M20 78c20-8 40-8 60 0M280 78c20-8 40-8 60 0" fill="none" stroke="#ffcc80" stroke-width="2" opacity="0.8"/>' +
            bodyPaths +
            '<text x="300" y="68" text-anchor="middle" font-size="52" fill="' +
            accent +
            '" font-family="KaiTi, STKaiti, SimKai, serif" font-weight="700">' +
            char +
            "</text>" +
            "</svg>"
        );
    }

    var ZODIAC_SVGS = {
        鼠: bannerSvg(
            "shu",
            "鼠",
            '<ellipse cx="118" cy="62" rx="34" ry="26" fill="#ef5350"/>' +
                '<circle cx="148" cy="42" r="18" fill="#ef5350"/>' +
                '<circle cx="154" cy="38" r="4" fill="#fff"/><circle cx="156" cy="38" r="2" fill="#333"/>' +
                '<path d="M86 58c-14 4-18 16-12 24" fill="none" stroke="#ef5350" stroke-width="5" stroke-linecap="round"/>' +
                '<path d="M82 72c-12 8-8 22 4 24" fill="none" stroke="#ef5350" stroke-width="4" stroke-linecap="round"/>'
        ),
        牛: bannerSvg(
            "niu",
            "牛",
            '<ellipse cx="118" cy="68" rx="38" ry="24" fill="#8d6e63"/>' +
                '<ellipse cx="118" cy="42" rx="26" ry="22" fill="#8d6e63"/>' +
                '<path d="M92 30c-8-10-4-18 4-14M144 30c8-10 4-18-4-14" fill="none" stroke="#5d4037" stroke-width="5" stroke-linecap="round"/>' +
                '<circle cx="106" cy="40" r="3" fill="#333"/><circle cx="130" cy="40" r="3" fill="#333"/>'
        ),
        虎: bannerSvg(
            "hu",
            "虎",
            '<ellipse cx="118" cy="66" rx="36" ry="28" fill="#fb8c00"/>' +
                '<circle cx="118" cy="40" r="28" fill="#fb8c00"/>' +
                '<path d="M88 28l-10-14 12 4M148 28l10-14-12 4" fill="none" stroke="#fb8c00" stroke-width="6" stroke-linecap="round"/>' +
                '<path d="M96 72h44M102 80h32" stroke="#5d4037" stroke-width="2" stroke-linecap="round"/>' +
                '<circle cx="106" cy="38" r="4" fill="#fff"/><circle cx="130" cy="38" r="4" fill="#fff"/>' +
                '<circle cx="106" cy="38" r="2" fill="#333"/><circle cx="130" cy="38" r="2" fill="#333"/>'
        ),
        兔: bannerSvg(
            "tu",
            "兔",
            '<ellipse cx="104" cy="28" rx="10" ry="28" fill="#f48fb1" transform="rotate(-8 104 28)"/>' +
                '<ellipse cx="132" cy="28" rx="10" ry="28" fill="#f48fb1" transform="rotate(8 132 28)"/>' +
                '<circle cx="118" cy="62" r="28" fill="#f48fb1"/>' +
                '<circle cx="106" cy="58" r="4" fill="#333"/><circle cx="130" cy="58" r="4" fill="#333"/>'
        ),
        龙: bannerSvg(
            "long",
            "龙",
            '<path d="M58 72c16-28 48-40 78-28 12 6 18 20 14 32-6 18-28 28-48 22-12-4-22-12-28-22" fill="#43a047"/>' +
                '<path d="M136 34c8-6 18-4 20 6 2 10-8 18-16 14" fill="#43a047"/>' +
                '<circle cx="128" cy="40" r="4" fill="#fff"/><circle cx="129" cy="40" r="2" fill="#333"/>' +
                '<path d="M62 70c-10 6-12 18-6 22" fill="none" stroke="#43a047" stroke-width="5" stroke-linecap="round"/>',
            "#2e7d32"
        ),
        蛇: bannerSvg(
            "she",
            "蛇",
            '<path d="M52 78c18-22 42-30 62-22 14 8 20 24 12 38-10 18-32 24-48 16-10-6-12-16-8-22 4-8 12-6 16 0 4 10-4 22-16 24" fill="none" stroke="#66bb6a" stroke-width="12" stroke-linecap="round"/>' +
                '<circle cx="134" cy="38" r="10" fill="#66bb6a"/>' +
                '<circle cx="138" cy="36" r="3" fill="#fff"/><circle cx="139" cy="36" r="1.5" fill="#333"/>',
            "#388e3c"
        ),
        马: bannerSvg(
            "ma",
            "马",
            '<path d="M56 78c10-32 32-48 58-42 14 4 22 16 20 30-2 16-18 28-36 26-14-2-26-10-32-20" fill="#d32f2f"/>' +
                '<path d="M132 32c10-12 24-14 30-6 6 12-4 22-16 20" fill="#d32f2f"/>' +
                '<circle cx="124" cy="42" r="4" fill="#fff"/><circle cx="125" cy="42" r="2" fill="#333"/>' +
                '<path d="M138 28c6-10 14-12 18-8" fill="none" stroke="#5d4037" stroke-width="4" stroke-linecap="round"/>' +
                '<path d="M60 76c-8 10-6 20 6 22" fill="none" stroke="#5d4037" stroke-width="5" stroke-linecap="round"/>'
        ),
        羊: bannerSvg(
            "yang",
            "羊",
            '<ellipse cx="118" cy="68" rx="32" ry="24" fill="#eceff1"/>' +
                '<circle cx="118" cy="44" r="24" fill="#eceff1"/>' +
                '<path d="M96 36c-6-8-14-10-10-4M140 36c6-8 14-10 10-4" fill="none" stroke="#b0bec5" stroke-width="5" stroke-linecap="round"/>' +
                '<circle cx="106" cy="42" r="3" fill="#333"/><circle cx="130" cy="42" r="3" fill="#333"/>'
        ),
        猴: bannerSvg(
            "hou",
            "猴",
            '<circle cx="82" cy="58" r="16" fill="#ffcc80"/><circle cx="154" cy="58" r="16" fill="#ffcc80"/>' +
                '<circle cx="118" cy="58" r="32" fill="#ffcc80"/>' +
                '<circle cx="104" cy="52" r="5" fill="#fff"/><circle cx="132" cy="52" r="5" fill="#fff"/>' +
                '<circle cx="104" cy="52" r="2.5" fill="#333"/><circle cx="132" cy="52" r="2.5" fill="#333"/>' +
                '<ellipse cx="118" cy="68" rx="10" ry="6" fill="#ffab91"/>'
        ),
        鸡: bannerSvg(
            "ji",
            "鸡",
            '<ellipse cx="118" cy="68" rx="32" ry="26" fill="#ffb74d"/>' +
                '<circle cx="118" cy="42" r="24" fill="#ffb74d"/>' +
                '<path d="M108 22l10-16 6 12 12-8-4 18" fill="#e53935"/>' +
                '<circle cx="106" cy="40" r="4" fill="#fff"/><circle cx="130" cy="40" r="4" fill="#fff"/>' +
                '<circle cx="106" cy="40" r="2" fill="#333"/><circle cx="130" cy="40" r="2" fill="#333"/>'
        ),
        狗: bannerSvg(
            "gou",
            "狗",
            '<ellipse cx="118" cy="68" rx="36" ry="24" fill="#a1887f"/>' +
                '<circle cx="118" cy="42" r="26" fill="#a1887f"/>' +
                '<path d="M88 48c-10-8-16 0-10 10M148 48c10-8 16 0 10 10" fill="#8d6e63"/>' +
                '<circle cx="106" cy="40" r="4" fill="#fff"/><circle cx="130" cy="40" r="4" fill="#fff"/>' +
                '<circle cx="106" cy="40" r="2" fill="#333"/><circle cx="130" cy="40" r="2" fill="#333"/>'
        ),
        猪: bannerSvg(
            "zhu",
            "猪",
            '<ellipse cx="118" cy="68" rx="38" ry="28" fill="#f48fb1"/>' +
                '<circle cx="118" cy="40" r="28" fill="#f48fb1"/>' +
                '<ellipse cx="118" cy="52" rx="14" ry="10" fill="#ffab91"/>' +
                '<circle cx="110" cy="50" r="4" fill="#ec407a"/><circle cx="126" cy="50" r="4" fill="#ec407a"/>' +
                '<circle cx="106" cy="38" r="4" fill="#fff"/><circle cx="130" cy="38" r="4" fill="#fff"/>' +
                '<circle cx="106" cy="38" r="2" fill="#333"/><circle cx="130" cy="38" r="2" fill="#333"/>'
        )
    };

    function getZodiacIconSvg(animal) {
        return ZODIAC_SVGS[animal] || "";
    }

    function getZodiacIconDataUri(animal) {
        var svg = getZodiacIconSvg(animal);
        if (!svg) return "";
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    global.ToolZodiacIcons = {
        getZodiacIconSvg: getZodiacIconSvg,
        getZodiacIconDataUri: getZodiacIconDataUri
    };
})(typeof window !== "undefined" ? window : this);
