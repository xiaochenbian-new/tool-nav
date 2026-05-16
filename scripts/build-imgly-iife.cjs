/**
 * 仅从已有 imgly.bundle.mjs 生成 imgly.bundle.iife.js（无需联网）。
 * 在 tool-nav 根目录：npm run build:imgly-iife
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");
const mjs = path.join(root, "pages", "libs", "imgly", "imgly.bundle.mjs");
const iife = path.join(root, "pages", "libs", "imgly", "imgly.bundle.iife.js");

if (!fs.existsSync(mjs)) {
    console.error("[build-imgly-iife] 未找到 " + path.relative(root, mjs) + "，请先执行 npm run copy:imgly");
    process.exit(1);
}

esbuild
    .build({
        entryPoints: [mjs],
        bundle: true,
        format: "iife",
        globalName: "ImglyBackgroundRemoval",
        platform: "browser",
        target: ["es2020"],
        outfile: iife,
        logLevel: "warning"
    })
    .then(function () {
        const mb = (fs.statSync(iife).size / 1024 / 1024).toFixed(2);
        console.log("[build-imgly-iife] 完成 → " + path.relative(root, iife) + " (" + mb + " MB)");
    })
    .catch(function (e) {
        console.error("[build-imgly-iife] 失败:", e.message || e);
        process.exit(1);
    });
