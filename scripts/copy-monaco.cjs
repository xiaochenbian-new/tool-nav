/**
 * 将 monaco-editor 的 AMD 构建复制到 vendor/monaco/min/vs，供 pages/文本对比.html 离线加载。
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules", "monaco-editor", "min", "vs");
const dest = path.join(root, "vendor", "monaco", "min", "vs");

if (!fs.existsSync(src)) {
    console.warn("[copy-monaco] 跳过：未找到", src, "（请先 npm install monaco-editor）");
    process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log("[copy-monaco] 已复制到", dest);
