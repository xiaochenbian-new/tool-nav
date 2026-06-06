const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const MAX_BODY = 10 * 1024 * 1024;

function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
}

function readBody(req) {
    return new Promise(function (resolve, reject) {
        var chunks = [];
        var size = 0;
        req.on("data", function (chunk) {
            size += chunk.length;
            if (size > MAX_BODY) {
                reject(new Error("请求体过大（上限 10MB）"));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", function () {
            resolve(Buffer.concat(chunks).toString("utf8"));
        });
        req.on("error", reject);
    });
}

function forwardRequest(payload) {
    return new Promise(function (resolve, reject) {
        var targetUrl;
        try {
            targetUrl = new URL(payload.url);
        } catch (e) {
            reject(new Error("无效的 URL"));
            return;
        }
        if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
            reject(new Error("仅支持 http / https"));
            return;
        }
        var lib = targetUrl.protocol === "https:" ? https : http;
        var headers = Object.assign({}, payload.headers || {});
        delete headers.host;
        delete headers.Host;
        headers.Host = targetUrl.host;
        var options = {
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            method: (payload.method || "GET").toUpperCase(),
            headers: headers
        };
        var req = lib.request(options, function (res) {
            var chunks = [];
            res.on("data", function (c) { chunks.push(c); });
            res.on("end", function () {
                var raw = Buffer.concat(chunks).toString("utf8");
                var ct = String(res.headers["content-type"] || "");
                var body = raw;
                if (/json/i.test(ct)) {
                    try { body = JSON.parse(raw); } catch (e) { /* keep string */ }
                } else {
                    var trimmed = raw.trim();
                    if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
                        try { body = JSON.parse(trimmed); } catch (e) { /* keep string */ }
                    }
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });
        req.on("error", reject);
        if (payload.body != null && payload.body !== "" && options.method !== "GET" && options.method !== "HEAD") {
            var bodyBuf = payload.bodyEncoding === "base64"
                ? Buffer.from(String(payload.body), "base64")
                : Buffer.from(String(payload.body), "utf8");
            req.write(bodyBuf);
        }
        req.end();
    });
}

function handleProxyApi(req, res, port) {
    setCors(res);
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return true;
    }
    if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, port: port }));
        return true;
    }
    if (req.url === "/proxy" && req.method === "POST") {
        readBody(req).then(function (text) {
            var payload = JSON.parse(text || "{}");
            if (!payload.url) {
                res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ error: "缺少 url" }));
                return;
            }
            return forwardRequest(payload);
        }).then(function (result) {
            if (!result) return;
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify(result));
        }).catch(function (err) {
            res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: err.message || String(err) }));
        });
        return true;
    }
    return false;
}

function getMimeType(filePath) {
    var ext = path.extname(filePath).toLowerCase();
    var map = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".map": "application/json; charset=utf-8"
    };
    return map[ext] || "application/octet-stream";
}

function serveStatic(req, res, rootDir) {
    var urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") {
        urlPath = "/index.html";
    }
    var filePath = path.normalize(path.join(rootDir, urlPath));
    if (!filePath.startsWith(rootDir)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return true;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return false;
    }
    res.writeHead(200, { "Content-Type": getMimeType(filePath) });
    fs.createReadStream(filePath).pipe(res);
    return true;
}

function checkHealth(host, port, timeoutMs) {
    timeoutMs = timeoutMs || 800;
    return new Promise(function (resolve) {
        var req = http.get("http://" + host + ":" + port + "/health", function (res) {
            resolve(res.statusCode === 200);
        });
        req.on("error", function () { resolve(false); });
        req.setTimeout(timeoutMs, function () {
            req.destroy();
            resolve(false);
        });
    });
}

module.exports = {
    setCors: setCors,
    readBody: readBody,
    forwardRequest: forwardRequest,
    handleProxyApi: handleProxyApi,
    serveStatic: serveStatic,
    checkHealth: checkHealth,
    MAX_BODY: MAX_BODY
};
