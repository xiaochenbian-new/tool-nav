/**
 * 下载 @imgly/background-removal 运行库与 isnet 模型到 pages/libs/，供证件照换底色离线使用。
 * 在 tool-nav 根目录执行：npm run copy:imgly
 *
 * 约 170MB（100 个分片 + resources.json + 运行库 bundle）。
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const IMGLY_VER = "1.5.5";
const ONNX_VER = "1.18.0";
const ZOD_VER = "3.23.8";
const NDARRAY_VER = "1.0.19";

const CDN = "https://cdn.jsdelivr.net/npm";
const DATA_BASE =
    "https://staticimgly.com/@imgly/background-removal-data/" + IMGLY_VER + "/dist/";

const root = path.join(__dirname, "..");
const libsImgly = path.join(root, "pages", "libs", "imgly");
const libsData = path.join(root, "pages", "libs", "imgly-data");
const tmpDeps = path.join(libsImgly, "_deps");

const CONCURRENCY = 6;

function mustDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

async function fetchOk(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
    return res;
}

async function downloadTo(url, dest) {
    if (fs.existsSync(dest)) {
        const st = fs.statSync(dest);
        if (st.size > 0) return "skip";
    }
    mustDir(path.dirname(dest));
    const res = await fetchOk(url);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return "ok";
}

async function pool(items, worker) {
    let i = 0;
    const n = Math.min(CONCURRENCY, items.length) || 1;
    async function run() {
        while (i < items.length) {
            const idx = i++;
            await worker(items[idx], idx);
        }
    }
    await Promise.all(Array.from({ length: n }, run));
}

async function downloadText(url) {
    const res = await fetchOk(url);
    return res.text();
}

async function downloadDataChunks(resources) {
    const hashes = new Set();
    for (const v of Object.values(resources)) {
        if (!v || !v.chunks) continue;
        for (const c of v.chunks) hashes.add(c.hash);
    }
    const list = [...hashes];
    console.log("[copy-imgly] 模型分片 " + list.length + " 个 → " + path.relative(root, libsData));
    let done = 0;
    await pool(list, async function (hash) {
        const url = DATA_BASE + hash;
        const dest = path.join(libsData, hash);
        await downloadTo(url, dest);
        done++;
        if (done % 10 === 0 || done === list.length) {
            console.log("[copy-imgly] 分片 " + done + "/" + list.length);
        }
    });
}

async function downloadRuntimeDeps() {
    mustDir(tmpDeps);
    const jobs = [
        {
            url: CDN + "/@imgly/background-removal@" + IMGLY_VER + "/dist/index.mjs",
            dest: path.join(tmpDeps, "imgly-index.mjs"),
            label: "imgly index.mjs"
        },
        {
            url: CDN + "/onnxruntime-web@" + ONNX_VER + "/dist/esm/ort.min.js",
            dest: path.join(tmpDeps, "onnxruntime-web.js"),
            label: "onnxruntime-web"
        },
        {
            url: CDN + "/onnxruntime-web@" + ONNX_VER + "/dist/esm/ort.webgpu.min.js",
            dest: path.join(tmpDeps, "onnxruntime-web-webgpu.js"),
            label: "onnxruntime-web/webgpu"
        },
        {
            url: CDN + "/ndarray@" + NDARRAY_VER + "/ndarray.js",
            dest: path.join(tmpDeps, "ndarray.js"),
            label: "ndarray"
        },
        {
            url: CDN + "/iota-array@1.0.0/iota.js",
            dest: path.join(tmpDeps, "iota-array.js"),
            label: "iota-array"
        },
        {
            url: CDN + "/is-buffer@1.1.6/index.js",
            dest: path.join(tmpDeps, "is-buffer.js"),
            label: "is-buffer"
        },
        {
            url: CDN + "/zod@" + ZOD_VER + "/lib/index.mjs",
            dest: path.join(tmpDeps, "zod.mjs"),
            label: "zod"
        }
    ];
    for (const j of jobs) {
        console.log("[copy-imgly] 下载 " + j.label);
        await downloadTo(j.url, j.dest);
    }
}

async function buildImglyBundle() {
    mustDir(libsImgly);
    const entry = path.join(tmpDeps, "imgly-index.mjs");
    const out = path.join(libsImgly, "imgly.bundle.mjs");
    console.log("[copy-imgly] esbuild 打包 → " + path.relative(root, out));
    await esbuild.build({
        entryPoints: [entry],
        bundle: true,
        format: "esm",
        platform: "browser",
        target: ["es2020"],
        outfile: out,
        logLevel: "warning",
        alias: {
            "onnxruntime-web": path.join(tmpDeps, "onnxruntime-web.js"),
            "onnxruntime-web/webgpu": path.join(tmpDeps, "onnxruntime-web-webgpu.js"),
            ndarray: path.join(tmpDeps, "ndarray.js"),
            "iota-array": path.join(tmpDeps, "iota-array.js"),
            "is-buffer": path.join(tmpDeps, "is-buffer.js"),
            zod: path.join(tmpDeps, "zod.mjs")
        }
    });
    const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(2);
    console.log("[copy-imgly] bundle 完成 (" + mb + " MB)");
}

async function main() {
    console.log("[copy-imgly] 开始（数据包约 170MB，请保持网络畅通）");
    mustDir(libsData);
    mustDir(libsImgly);

    const resourcesUrl = DATA_BASE + "resources.json";
    console.log("[copy-imgly] resources.json");
    const resourcesText = await downloadText(resourcesUrl);
    fs.writeFileSync(path.join(libsData, "resources.json"), resourcesText);
    const resources = JSON.parse(resourcesText);

    await downloadRuntimeDeps();
    await buildImglyBundle();
    await downloadDataChunks(resources);

    try {
        fs.rmSync(tmpDeps, { recursive: true, force: true });
    } catch (_) {}

    console.log("[copy-imgly] 全部完成。证件照换底色工具将使用 pages/libs/imgly-data/ 与 imgly.bundle.mjs");
}

main().catch(function (e) {
    console.error("[copy-imgly] 失败:", e.message || e);
    process.exit(1);
});
