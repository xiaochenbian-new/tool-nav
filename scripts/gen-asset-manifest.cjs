/**
 * 生成 asset-manifest.json：每个工具的完整静态资源（JS/CSS/字体/图片/wasm 等）。
 * - 解析 HTML 的 script/link/img/source/... 引用
 * - 解析 CSS 内 url()
 * - 引用到 vendor/某包 时，纳入该包全部静态文件（覆盖 Monaco 动态加载等）
 * 用法：node scripts/gen-asset-manifest.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const ASSET_EXT =
    /\.(?:js|mjs|cjs|css|woff2?|ttf|otf|eot|wasm|map|svg|png|jpe?g|gif|webp|ico|json|html)$/i;

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
    if (!ref || /^(?:data:|blob:|https?:|\/\/|#)/i.test(ref)) return null;
    const cleaned = String(ref).trim().split("#")[0].split("?")[0];
    if (!cleaned || !ASSET_EXT.test(cleaned)) return null;
    const abs = path.resolve(path.dirname(fromFile), cleaned);
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
    if (!(abs === root || abs.startsWith(rootWithSep)) || !fs.existsSync(abs)) return null;
    return toPosixRel(abs);
}

function extractCssUrls(cssText, fromFile, into) {
    const re = /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi;
    let m;
    while ((m = re.exec(cssText))) {
        const rel = resolveRef(fromFile, m[2]);
        if (rel) into.add(rel);
    }
}

function extractHtmlRefs(htmlPath) {
    const html = fs.readFileSync(htmlPath, "utf8");
    const refs = new Set();
    // script/link/img/source/video/audio/embed/use/image
    const attrRe =
        /(?:src|href|data|xlink:href)\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = attrRe.exec(html))) {
        const rel = resolveRef(htmlPath, m[1]);
        if (rel) refs.add(rel);
    }
    // inline style url()
    extractCssUrls(html, htmlPath, refs);
    // 工具页自身也纳入（刷新后可走本地 HTML）
    refs.add(toPosixRel(htmlPath));
    return refs;
}

function expandCssDeps(keys) {
    const out = new Set(keys);
    const queue = Array.from(keys).filter((k) => k.endsWith(".css"));
    while (queue.length) {
        const cssRel = queue.pop();
        const abs = path.join(root, cssRel);
        if (!fs.existsSync(abs)) continue;
        const text = fs.readFileSync(abs, "utf8");
        const found = new Set();
        extractCssUrls(text, abs, found);
        found.forEach((rel) => {
            if (out.has(rel)) return;
            out.add(rel);
            if (rel.endsWith(".css")) queue.push(rel);
        });
    }
    return out;
}

function listBundle(prefix) {
    const dir = path.join(root, prefix);
    const files = [];
    walkFiles(dir, files);
    return files.map(toPosixRel).sort();
}

function vendorPackageOf(rel) {
    // vendor/<pkg>/...
    const m = /^vendor\/([^/]+)\//.exec(rel);
    return m ? m[1] : null;
}

const pagesDir = path.join(root, "pages");
const byPage = {};
const packageCache = Object.create(null);

function packageFiles(pkg) {
    if (!packageCache[pkg]) {
        packageCache[pkg] = listBundle("vendor/" + pkg);
    }
    return packageCache[pkg];
}

const sharedLibs = listBundle("pages/libs");

for (const name of fs.readdirSync(pagesDir)) {
    if (!name.endsWith(".html")) continue;
    const htmlPath = path.join(pagesDir, name);
    const pageRel = "pages/" + name;
    let refs = extractHtmlRefs(htmlPath);
    refs = expandCssDeps(refs);

    // 引用到 vendor 包 → 整包纳入（覆盖动态 import / AMD worker）
    const pkgs = new Set();
    refs.forEach((r) => {
        const pkg = vendorPackageOf(r);
        if (pkg) pkgs.add(pkg);
    });
    pkgs.forEach((pkg) => {
        packageFiles(pkg).forEach((f) => refs.add(f));
    });

    // 共用 libs 始终带上
    sharedLibs.forEach((f) => refs.add(f));

    byPage[pageRel] = Array.from(refs).sort();
}

const manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    shared: sharedLibs,
    byPage: byPage,
    note: "Full tool static set: HTML + refs + css url() + whole vendor packages touched."
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
