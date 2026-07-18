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

function isDebugArtifact(name) {
    return /\.map$/i.test(name) || /\.(js|css)\.gz$/i.test(name);
}

function copyThing(src, dest, label) {
    if (!fs.existsSync(src)) {
        console.warn("[copy-vendor] 跳过 " + label + "：未找到\n  " + src);
        return false;
    }
    const st = fs.statSync(src);
    if (st.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        fs.cpSync(src, dest, {
            recursive: true,
            filter: function (srcPath) {
                return !isDebugArtifact(path.basename(srcPath));
            }
        });
    } else {
        if (isDebugArtifact(path.basename(src))) {
            console.warn("[copy-vendor] 跳过调试文件 " + label + "：\n  " + src);
            return false;
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }
    console.log("[copy-vendor] " + label + " -> " + path.relative(root, dest));
    return true;
}

async function buildEsm(entryFile, outFile, label, extraOpts) {
    var entryPath = path.join(entriesDir, entryFile);
    if (!fs.existsSync(entryPath)) {
        console.warn("[copy-vendor] 跳过 bundle " + label + "：无入口 " + entryPath);
        return;
    }
    mustDir(path.dirname(outFile));
    var opts = {
        entryPoints: [entryPath],
        bundle: true,
        format: "esm",
        platform: "browser",
        target: ["es2020"],
        outfile: outFile,
        sourcemap: false,
        logLevel: "warning",
    };
    if (extraOpts) {
        Object.keys(extraOpts).forEach(function (k) {
            opts[k] = extraOpts[k];
        });
    }
    await esbuild.build(opts);
    console.log("[copy-vendor] bundle " + label + " -> " + path.relative(root, outFile));
}

async function buildMdDocxIife() {
    var entryPath = path.join(entriesDir, "md-docx-global.mjs");
    if (!fs.existsSync(entryPath)) {
        console.warn("[copy-vendor] 跳过 md-docx-offline：无入口 " + entryPath);
        return;
    }
    var outFile = path.join(vendor, "md-docx", "md-docx-offline.js");
    mustDir(path.dirname(outFile));
    await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        format: "iife",
        platform: "browser",
        target: ["es2020"],
        outfile: outFile,
        sourcemap: false,
        logLevel: "warning",
        alias: {
            buffer: path.join(root, "node_modules", "buffer", "index.js"),
        },
        define: {
            global: "globalThis",
            "process.env.NODE_DEBUG": "false",
        },
    });
    console.log("[copy-vendor] md-docx IIFE（file:// 离线）-> " + path.relative(root, outFile));
}

async function buildZhTranIife() {
    var entryPath = path.join(entriesDir, "zh-tran-global.mjs");
    if (!fs.existsSync(entryPath)) {
        console.warn("[copy-vendor] 跳过 zh-tran-offline：无入口 " + entryPath);
        return;
    }
    var outFile = path.join(vendor, "zh-tran", "zh-tran-offline.js");
    mustDir(path.dirname(outFile));
    await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        format: "iife",
        platform: "browser",
        target: ["es2020"],
        outfile: outFile,
        sourcemap: false,
        logLevel: "warning"
    });
    console.log("[copy-vendor] zh-tran IIFE（file:// 离线）-> " + path.relative(root, outFile));
}

async function main() {
    mustDir(vendor);
    mustDir(bundlesDir);

    const monacoSrc = path.join(root, "node_modules", "monaco-editor", "min", "vs");
    const monacoDest = path.join(vendor, "monaco", "min", "vs");
    if (fs.existsSync(monacoSrc)) {
        fs.mkdirSync(path.dirname(monacoDest), { recursive: true });
        fs.cpSync(monacoSrc, monacoDest, {
            recursive: true,
            filter: function (srcPath) {
                return !isDebugArtifact(path.basename(srcPath));
            }
        });
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

    copyThing(
        path.join(root, "node_modules", "mathjs", "lib", "browser", "math.js"),
        path.join(vendor, "mathjs", "math.js"),
        "mathjs（浏览器 UMD，单位换算等离线）"
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

    const codepageDest = path.join(vendor, "codepage");
    copyThing(
        path.join(root, "node_modules", "codepage", "dist", "cpexcel.full.js"),
        path.join(codepageDest, "cpexcel.full.js"),
        "codepage/cpexcel.full.js（GBK/CP936 等）"
    );
    copyThing(path.join(root, "node_modules", "codepage", "cputils.js"), path.join(codepageDest, "cputils.js"), "codepage/cputils.js");

    await buildEsm("sql-formatter.mjs", path.join(bundlesDir, "sql-formatter.mjs"), "sql-formatter");
    await buildEsm("qs.mjs", path.join(bundlesDir, "qs.mjs"), "qs");
    await buildEsm("toml.mjs", path.join(bundlesDir, "toml.mjs"), "toml");
    await buildEsm("uuid.mjs", path.join(bundlesDir, "uuid.mjs"), "uuid");
    await buildEsm("zh-tran.mjs", path.join(bundlesDir, "zh-tran.mjs"), "zh-tran");
    await buildEsm("md-docx.mjs", path.join(bundlesDir, "md-docx.mjs"), "md-docx（Markdown→Word）", {
        alias: {
            buffer: path.join(root, "node_modules", "buffer", "index.js"),
        },
        define: {
            global: "globalThis",
            "process.env.NODE_DEBUG": "false",
        },
    });
    await buildZhTranIife();
    await buildMdDocxIife();

    // KaTeX（预览公式）
    copyThing(
        path.join(root, "node_modules", "katex", "dist", "katex.min.js"),
        path.join(vendor, "katex", "katex.min.js"),
        "katex.min.js"
    );
    copyThing(
        path.join(root, "node_modules", "katex", "dist", "katex.min.css"),
        path.join(vendor, "katex", "katex.min.css"),
        "katex.min.css"
    );
    copyThing(
        path.join(root, "node_modules", "katex", "dist", "fonts"),
        path.join(vendor, "katex", "fonts"),
        "katex/fonts"
    );
}

main().catch(function (e) {
    console.error(e);
    process.exit(1);
});
