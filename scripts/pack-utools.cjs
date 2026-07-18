/**
 * 生成 uTools 可打包的干净目录（不含 .map / .js.gz 等调试文件）。
 * 用法：npm run pack:utools
 * 然后在 uTools 开发者工具中，将 plugin.json 指向 dist-utools/plugin.json 再打包。
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "dist-utools");

const COPY_ITEMS = [
    "plugin.json",
    "index.html",
    "pages",
    "vendor",
    "photo-background-change"
];

function isDebugArtifact(name) {
    return /\.map$/i.test(name) || /\.(js|css)\.gz$/i.test(name);
}

function copyFiltered(src, dest) {
    if (!fs.existsSync(src)) {
        return false;
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            if (isDebugArtifact(entry.name)) {
                continue;
            }
            copyFiltered(path.join(src, entry.name), path.join(dest, entry.name));
        }
    } else {
        if (isDebugArtifact(path.basename(src))) {
            return false;
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }
    return true;
}

function removeDebugArtifacts(dir) {
    if (!fs.existsSync(dir)) {
        return 0;
    }
    let removed = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            removed += removeDebugArtifacts(full);
        } else if (isDebugArtifact(entry.name)) {
            fs.unlinkSync(full);
            removed += 1;
        }
    }
    return removed;
}

function main() {
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outDir, { recursive: true });

    let copied = 0;
    for (const item of COPY_ITEMS) {
        const src = path.join(root, item);
        const dest = path.join(outDir, item);
        if (copyFiltered(src, dest)) {
            copied += 1;
            console.log("[pack-utools] " + item);
        } else {
            console.log("[pack-utools] 跳过（不存在）: " + item);
        }
    }

    const removed = removeDebugArtifacts(outDir);
    console.log("[pack-utools] 完成 -> " + path.relative(root, outDir));
    console.log("[pack-utools] 已复制 " + copied + " 项，清理调试文件 " + removed + " 个");
    console.log("[pack-utools] 请在 uTools 开发者工具中将 plugin.json 指向:");
    console.log("             " + path.join(outDir, "plugin.json"));
}

main();
