/**
 * 本地工具站 + 跨域代理（一体化）。
 * 用法：npm run serve
 */
const http = require("http");
const path = require("path");
const { handleProxyApi, serveStatic } = require("./proxy-core.cjs");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8765);
const ROOT = path.join(__dirname, "..");

const server = http.createServer(function (req, res) {
    if (handleProxyApi(req, res, PORT)) {
        return;
    }
    if (req.method === "GET" || req.method === "HEAD") {
        if (serveStatic(req, res, ROOT)) {
            return;
        }
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
});

server.listen(PORT, HOST, function () {
    console.log("[local-server] 已启动，监听 " + HOST + ":" + PORT);
    console.log("[local-server] 工具页: /pages/Js请求工具.html");
    console.log("[local-server] 跨域代理已内置（/health、/proxy）");
});
