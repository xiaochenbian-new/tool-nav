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

const items = ["index.html", "plugin.json", "pages", "vendor", "_headers"];
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
