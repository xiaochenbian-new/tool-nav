/**
 * 离线资源：Monaco、CodeMirror、常用 UMD 库、esbuild 打出的 ESM bundles。
 * 在 tool-nav 根目录执行：npm install && npm run copy:vendor
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");
const vendor = path.join(root, "vendor");
const bundlesDir = path.join(vendor, "bundles");
const entriesDir = path.join(__dirname, "vendor-bundle-entries");

function mustDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

function copyThing(src, dest, label) {
    if (!fs.existsSync(src)) {
        console.warn("[copy-vendor] 跳过 " + label + "：未找到\n  " + src);
        return false;
    }
    const st = fs.statSync(src);
    if (st.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        fs.cpSync(src, dest, { recursive: true });
    } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }
    console.log("[copy-vendor] " + label + " -> " + path.relative(root, dest));
    return true;
}

async function buildEsm(entryFile, outFile, label) {
    const entryPath = path.join(entriesDir, entryFile);
    if (!fs.existsSync(entryPath)) {
        console.warn("[copy-vendor] 跳过 bundle " + label + "：无入口 " + entryPath);
        return;
    }
    mustDir(path.dirname(outFile));
    await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        format: "esm",
        platform: "browser",
        target: ["es2020"],
        outfile: outFile,
        logLevel: "warning"
    });
    console.log("[copy-vendor] bundle " + label + " -> " + path.relative(root, outFile));
}

async function main() {
    mustDir(vendor);
    mustDir(bundlesDir);

    const monacoSrc = path.join(root, "node_modules", "monaco-editor", "min", "vs");
    const monacoDest = path.join(vendor, "monaco", "min", "vs");
    if (fs.existsSync(monacoSrc)) {
        fs.mkdirSync(path.dirname(monacoDest), { recursive: true });
        fs.cpSync(monacoSrc, monacoDest, { recursive: true });
        console.log("[copy-vendor] monaco -> " + path.relative(root, monacoDest));
    } else {
        console.warn("[copy-vendor] 跳过 monaco：请先安装 devDependency monaco-editor");
    }

    copyThing(path.join(root, "node_modules", "codemirror"), path.join(vendor, "codemirror"), "codemirror");

    copyThing(
        path.join(root, "node_modules", "jsonrepair", "lib", "umd", "jsonrepair.min.js"),
        path.join(vendor, "jsonrepair", "jsonrepair.min.js"),
        "jsonrepair"
    );

    copyThing(
        path.join(root, "node_modules", "js-yaml", "dist", "js-yaml.min.js"),
        path.join(vendor, "js-yaml", "js-yaml.min.js"),
        "js-yaml"
    );

    copyThing(
        path.join(root, "node_modules", "xlsx", "dist", "xlsx.full.min.js"),
        path.join(vendor, "xlsx", "xlsx.full.min.js"),
        "xlsx"
    );

    copyThing(
        path.join(root, "node_modules", "alasql", "dist", "alasql.min.js"),
        path.join(vendor, "alasql", "alasql.min.js"),
        "alasql"
    );

    const jbLib = path.join(root, "node_modules", "js-beautify", "js", "lib");
    ["beautify.js", "beautify-html.js", "beautify-css.js"].forEach(function (f) {
        copyThing(path.join(jbLib, f), path.join(vendor, "js-beautify", f), "js-beautify/" + f);
    });

    copyThing(
        path.join(root, "node_modules", "sql-formatter", "dist", "sql-formatter.min.js"),
        path.join(vendor, "sql-formatter", "sql-formatter.min.js"),
        "sql-formatter (UMD，file:// 离线可用)"
    );

    await buildEsm("sql-formatter.mjs", path.join(bundlesDir, "sql-formatter.mjs"), "sql-formatter");
    await buildEsm("qs.mjs", path.join(bundlesDir, "qs.mjs"), "qs");
    await buildEsm("toml.mjs", path.join(bundlesDir, "toml.mjs"), "toml");
    await buildEsm("uuid.mjs", path.join(bundlesDir, "uuid.mjs"), "uuid");
    await buildEsm("zh-tran.mjs", path.join(bundlesDir, "zh-tran.mjs"), "zh-tran");
}

main().catch(function (e) {
    console.error(e);
    process.exit(1);
});
