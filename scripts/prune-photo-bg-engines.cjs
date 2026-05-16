/**
 * 从证件照换底色工具.html 移除 MediaPipe / 经典泛洪及仅被其使用的死代码。
 * 运行：node scripts/prune-photo-bg-engines.cjs
 */
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "pages", "证件照换底色工具.html");
let html = fs.readFileSync(htmlPath, "utf8");

const REMOVE_FUNCS_DEAD_ONLY = [
    "restoreMisclassifiedBgOnPerson",
    "patchExteriorStudioResidual",
    "patchResidualStudioBg",
    "postCompositeRedFringeCleanup",
    "boostAlphaPersonInterior",
    "repairHairEdgeFromInterior"
];

const REMOVE_FUNCS = [
    "forceOpaqueAlphaOnHair",
    "restoreFgAlphaAfterBlur",
    "morphDilateFgBin",
    "morphErodeFgBin",
    "morphCloseFgBin",
    "fillDarkHolesInFgBin",
    "isStrictExteriorStudioPixel",
    "forceFgBinOnPersonCore",
    "buildMatteSoftAlpha",
    "compositeHardPersonPreserve",
    "cornerDistancePercentile",
    "floodBackgroundMask",
    "countBgRatio",
    "floodBackgroundMaskAdaptive",
    "fgAlphaFromBgMask",
    "clampFgAlphaByDistance",
    "fillHairPartingAlphaGaps",
    "refineAlphaMpFalseForeground",
    "trimAlphaNearEstimatedOrigBg",
    "refineAlphaWhiteStudio",
    "refineAlphaRedStudio",
    "refineAlphaStudioEdge",
    "mergeMpAlphaWithColorMatte",
    "isPureStudioBackgroundPixel",
    "looksLikeOriginalStudioBg",
    "isNearOldStudioResidual",
    "resolvePixelBgMode",
    "restoreMisclassifiedBgOnPerson",
    "patchExteriorStudioResidual",
    "patchResidualStudioBg",
    "snapAlphaStrictFg",
    "compositeBgOnlyExact",
    "postCompositeRedFringeCleanup",
    "boostAlphaPersonInterior",
    "repairHairEdgeFromInterior",
    "buildClassicAlphaAndFlood",
    "resizeFloatMaskBilinear",
    "ensureMpSegmenter",
    "startMpSegmentation",
    "startMlSegmentation",
    "erodeBinaryBgMask",
    "fillHairInteriorAlphaGaps",
    "fillHairInteriorAlphaGapsConservative",
    "refineAlphaWhiteStudio",
    "refineAlphaRedStudio",
    "minFilterAlphaFloat",
    "edgeDistancePercentile"
];

function removeFunctionBlock(source, name) {
    const patterns = [
        new RegExp("\\n(\\s*/\\*\\*[\\s\\S]*?\\*/\\s*\\n)?\\s*function\\s+" + name + "\\s*\\("),
        new RegExp("\\n\\s*function\\s+" + name + "\\s*\\(")
    ];
    let start = -1;
    for (const re of patterns) {
        const m = re.exec(source);
        if (m) {
            start = m.index;
            break;
        }
    }
    if (start < 0) {
        console.warn("[prune] 未找到 function " + name);
        return source;
    }
    const braceStart = source.indexOf("{", start);
    if (braceStart < 0) return source;
    let depth = 0;
    let i = braceStart;
    for (; i < source.length; i++) {
        const ch = source[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                i++;
                break;
            }
        }
    }
    console.log("[prune] 删除 function " + name);
    return source.slice(0, start) + source.slice(i);
}

const scriptStart = html.indexOf("<script>");
const scriptEnd = html.lastIndexOf("</script>");
if (scriptStart < 0 || scriptEnd < 0) {
    console.error("no script block");
    process.exit(1);
}
let head = html.slice(0, scriptStart + "<script>".length);
let script = html.slice(scriptStart + "<script>".length, scriptEnd);
const tail = html.slice(scriptEnd);

for (const fn of REMOVE_FUNCS_DEAD_ONLY) {
    script = removeFunctionBlock(script, fn);
}

for (const fn of REMOVE_FUNCS) {
    script = removeFunctionBlock(script, fn);
}

html = head + script + tail;
fs.writeFileSync(htmlPath, html, "utf8");
console.log("[prune] 完成，已写回 " + htmlPath);
