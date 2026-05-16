/**
 * 下载 @imgly/background-removal 运行库与 isnet 模型到 pages/libs/，供证件照换底色离线使用。
 * 在 tool-nav 根目录执行：npm run copy:imgly
 *
 * 约 170MB（100 个分片 + resources.json + 运行库 bundle）。
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const esbuild = require("esbuild");
const { generateFileProtocolAssets } = require("./generate-imgly-file-assets.cjs");

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

/** Node 16 及以下无全局 fetch，用 https/http 下载 */
function requestBuffer(url, redirectsLeft) {
    return new Promise(function (resolve, reject) {
        let parsed;
        try {
            parsed = new URL(url);
        } catch (e) {
            reject(e);
            return;
        }
        const lib = parsed.protocol === "https:" ? https : http;
        const req = lib.get(
            parsed,
            { headers: { "User-Agent": "tool-nav-copy-imgly/1.0" } },
            function (res) {
                if (
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location &&
                    redirectsLeft > 0
                ) {
                    res.resume();
                    requestBuffer(new URL(res.headers.location, parsed).href, redirectsLeft - 1).then(
                        resolve,
                        reject
                    );
                    return;
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error("HTTP " + res.statusCode + " " + url));
                    return;
                }
                const chunks = [];
                res.on("data", function (chunk) {
                    chunks.push(chunk);
                });
                res.on("end", function () {
                    resolve(Buffer.concat(chunks));
                });
                res.on("error", reject);
            }
        );
        req.on("error", reject);
        req.setTimeout(120000, function () {
            req.destroy(new Error("请求超时: " + url));
        });
    });
}

async function downloadTo(url, dest) {
    if (fs.existsSync(dest)) {
        const st = fs.statSync(dest);
        if (st.size > 0) return "skip";
    }
    mustDir(path.dirname(dest));
    const buf = await requestBuffer(url, 5);
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
    const buf = await requestBuffer(url, 5);
    return buf.toString("utf8");
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

function imglyEsbuildAlias() {
    return {
        "onnxruntime-web": path.join(tmpDeps, "onnxruntime-web.js"),
        "onnxruntime-web/webgpu": path.join(tmpDeps, "onnxruntime-web-webgpu.js"),
        ndarray: path.join(tmpDeps, "ndarray.js"),
        "iota-array": path.join(tmpDeps, "iota-array.js"),
        "is-buffer": path.join(tmpDeps, "is-buffer.js"),
        zod: path.join(tmpDeps, "zod.mjs")
    };
}

async function buildImglyBundle() {
    mustDir(libsImgly);
    const entry = path.join(tmpDeps, "imgly-index.mjs");
    const alias = imglyEsbuildAlias();
    const common = {
        entryPoints: [entry],
        bundle: true,
        platform: "browser",
        target: ["es2020"],
        logLevel: "warning",
        alias
    };

    const outMjs = path.join(libsImgly, "imgly.bundle.mjs");
    console.log("[copy-imgly] esbuild ESM → " + path.relative(root, outMjs));
    await esbuild.build({ ...common, format: "esm", outfile: outMjs });

    const outIife = path.join(libsImgly, "imgly.bundle.iife.js");
    console.log("[copy-imgly] esbuild IIFE（file:// 本地打开）→ " + path.relative(root, outIife));
    await esbuild.build({
        ...common,
        format: "iife",
        globalName: "ImglyBackgroundRemoval",
        outfile: outIife
    });

    const mbMjs = (fs.statSync(outMjs).size / 1024 / 1024).toFixed(2);
    const mbIife = (fs.statSync(outIife).size / 1024 / 1024).toFixed(2);
    console.log("[copy-imgly] bundle 完成 (mjs " + mbMjs + " MB, iife " + mbIife + " MB)");
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
    generateFileProtocolAssets();

    try {
        fs.rmSync(tmpDeps, { recursive: true, force: true });
    } catch (_) {}

    console.log(
        "[copy-imgly] 全部完成。本地 file:// 打开需 resources.embed.js、chunks-js/ 与 imgly.bundle.iife.js"
    );
}

main().catch(function (e) {
    console.error("[copy-imgly] 失败:", e.message || e);
    process.exit(1);
});
