/**
 * 为 file:// 本地打开生成 resources.embed.js 与 chunks-js/*.js
 * （浏览器禁止 file 页面跨文件 fetch，但允许 <script src> 加载）
 *
 * 在 tool-nav 根目录：npm run generate:imgly-file-assets
 * 或由 copy:imgly 在下载完成后自动调用
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const libsData = path.join(root, "pages", "libs", "imgly-data");
const resourcesPath = path.join(libsData, "resources.json");
const embedPath = path.join(libsData, "resources.embed.js");
const chunksJsDir = path.join(libsData, "chunks-js");
const HASH_RE = /^[a-f0-9]{64}$/i;

function mustDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

function generateFileProtocolAssets() {
    if (!fs.existsSync(resourcesPath)) {
        throw new Error("未找到 resources.json，请先执行 npm run copy:imgly");
    }

    const resourcesText = fs.readFileSync(resourcesPath, "utf8");
    JSON.parse(resourcesText);
    fs.writeFileSync(embedPath, "window.__IMGLY_RESOURCE_MAP=" + resourcesText + ";\n", "utf8");

    mustDir(chunksJsDir);
    const hashes = fs.readdirSync(libsData).filter(function (name) {
        return HASH_RE.test(name) && fs.statSync(path.join(libsData, name)).isFile();
    });

    console.log("[generate-imgly-file] resources.embed.js");
    console.log("[generate-imgly-file] 分片脚本 " + hashes.length + " 个 → chunks-js/");

    let done = 0;
    for (let i = 0; i < hashes.length; i++) {
        const hash = hashes[i];
        const src = path.join(libsData, hash);
        const dest = path.join(chunksJsDir, hash + ".js");
        const st = fs.statSync(src);
        if (fs.existsSync(dest)) {
            const dstSt = fs.statSync(dest);
            if (dstSt.mtimeMs >= st.mtimeMs && dstSt.size > 64) {
                done++;
                continue;
            }
        }
        const b64 = fs.readFileSync(src).toString("base64");
        fs.writeFileSync(
            dest,
            'window.__IMGLY_CHUNK_B64=window.__IMGLY_CHUNK_B64||{};window.__IMGLY_CHUNK_B64["' +
                hash +
                '"]="' +
                b64 +
                '";\n',
            "utf8"
        );
        done++;
        if (done % 10 === 0 || done === hashes.length) {
            console.log("[generate-imgly-file] " + done + "/" + hashes.length);
        }
    }

    console.log("[generate-imgly-file] 完成（供 file:// 双击打开使用）");
}

if (require.main === module) {
    try {
        generateFileProtocolAssets();
    } catch (e) {
        console.error("[generate-imgly-file] 失败:", e.message || e);
        process.exit(1);
    }
}

module.exports = { generateFileProtocolAssets };
