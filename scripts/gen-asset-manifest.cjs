/**
 * 生成 asset-manifest.json：每个工具页直接引用的 JS/CSS + vendor 包依赖。
 * 用法：node scripts/gen-asset-manifest.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const ASSET_EXT = /\.(?:js|mjs|cjs|css|woff2?|ttf|otf|eot|wasm|map|svg)$/i;

function walkFiles(dir, out) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) walkFiles(full, out);
        else if (ASSET_EXT.test(name)) out.push(full);
    }
}

function toPosixRel(abs) {
    return path.relative(root, abs).split(path.sep).join("/");
}

function resolveRef(fromFile, ref) {
    if (!ref || /^(?:data:|blob:|https?:|\/\/)/i.test(ref)) return null;
    const cleaned = ref.split("#")[0].split("?")[0];
    if (!cleaned || !ASSET_EXT.test(cleaned)) return null;
    const abs = path.resolve(path.dirname(fromFile), cleaned);
    if (!abs.startsWith(root) || !fs.existsSync(abs)) return null;
    return toPosixRel(abs);
}

function extractRefs(htmlPath) {
    const html = fs.readFileSync(htmlPath, "utf8");
    const refs = new Set();
    const re =
        /<(?:script[^>]+src|link[^>]+href)\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html))) {
        const rel = resolveRef(htmlPath, m[1]);
        if (rel) refs.add(rel);
    }
    return Array.from(refs).sort();
}

function listVendorBundle(prefix) {
    const dir = path.join(root, prefix);
    const files = [];
    walkFiles(dir, files);
    return files.map(toPosixRel).sort();
}

const pagesDir = path.join(root, "pages");
const byPage = {};
const allPageAssets = new Set();

for (const name of fs.readdirSync(pagesDir)) {
    if (!name.endsWith(".html")) continue;
    const pageRel = "pages/" + name;
    const refs = extractRefs(path.join(pagesDir, name));
    byPage[pageRel] = refs;
    refs.forEach((r) => allPageAssets.add(r));
}

const monacoFiles = listVendorBundle("vendor/monaco");
const katexFiles = listVendorBundle("vendor/katex");
const sharedLibs = listVendorBundle("pages/libs");

// 任一页引用 monaco loader → 附带整个 monaco 包（含 worker）
for (const page of Object.keys(byPage)) {
    const refs = byPage[page];
    const needsMonaco = refs.some((r) => r.indexOf("vendor/monaco/") === 0);
    const needsKatex = refs.some((r) => r.indexOf("vendor/katex/") === 0);
    const merged = new Set(refs);
    if (needsMonaco) monacoFiles.forEach((f) => merged.add(f));
    if (needsKatex) katexFiles.forEach((f) => merged.add(f));
    byPage[page] = Array.from(merged).sort();
}

const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    shared: sharedLibs,
    byPage: byPage,
    note: "Visit a tool → enqueue byPage[tool.path] + shared; SW serves from IndexedDB when present."
};

const outPath = path.join(root, "asset-manifest.json");
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf8");

const pageCount = Object.keys(byPage).length;
const uniq = new Set(sharedLibs);
Object.values(byPage).forEach((arr) => arr.forEach((x) => uniq.add(x)));
console.log(
    "[gen-asset-manifest] pages=" +
        pageCount +
        " uniqueAssets=" +
        uniq.size +
        " -> asset-manifest.json"
);
