/**
 * 打包静态站点到 dist-site/（供 GitHub Pages / Cloudflare Pages 使用）。
 * 用法：npm run build:site
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "dist-site");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 404.html 必须打包：Cloudflare Pages 无顶层 404 时会按 SPA 把缺失路径回退成 index.html
// _routes.json / functions 仅 Cloudflare Pages 使用（避开中文 .html 的坏 308）
const items = [
    "index.html",
    "404.html",
    "sw.js",
    "asset-manifest.json",
    "plugin.json",
    "pages",
    "vendor",
    "_headers",
    "_routes.json",
    "functions"
];
for (const it of items) {
    const src = path.join(root, it);
    if (!fs.existsSync(src)) {
        console.log("[pack-site] 跳过（不存在）: " + it);
        continue;
    }
    fs.cpSync(src, path.join(out, it), { recursive: true });
    console.log("[pack-site] " + it + " -> dist-site/" + it);
}

console.log("[pack-site] 完成 -> dist-site/");
