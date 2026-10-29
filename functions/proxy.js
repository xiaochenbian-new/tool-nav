/**
 * Cloudflare Pages Function: /proxy
 *
 * 「Js请求工具（JS 编排）」的浏览器端跨域代理。语义与本地开发服务器
 * scripts/proxy-core.cjs 的 handleProxyApi 保持一致：
 *
 *   GET  /proxy            -> { ok: true }        探活，前端据此判断代理是否真的可用
 *   POST /proxy            -> { status, headers, body, finalUrl, redirected }
 *     请求体: { url, method, headers, body, bodyEncoding }
 *     失败时 -> { error: "..." }
 *
 * 之所以需要它：浏览器直连第三方接口会被 CORS 拦；GitHub Pages 上没有任何服务端
 * 函数，所以这个端点只在本机 dev server 与 Cloudflare Pages 上存在。
 */

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024; // 单次响应上限，避免把边缘内存打满
const TIMEOUT_MS = 25000;
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400"
};

function jsonResponse(payload, status) {
    return new Response(JSON.stringify(payload), {
        status: status || 200,
        headers: Object.assign({
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
        }, CORS_HEADERS)
    });
}

/** 明显的内网 / 回环地址直接拒绝，避免这个公开端点被当成内网探测跳板。 */
function isBlockedHost(hostname) {
    var h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
    if (!h) return true;
    if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "::" || h === "::1") return true;
    var m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    var a = Number(m[1]);
    var b = Number(m[2]);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
}

function headersToObject(headers) {
    var out = {};
    headers.forEach(function (value, key) {
        out[key] = value;
    });
    return out;
}

function headerEntriesForForward(src) {
    var skip = { host: 1, connection: 1, "content-length": 1, "transfer-encoding": 1, "accept-encoding": 1 };
    var out = {};
    if (!src || typeof src !== "object") return out;
    Object.keys(src).forEach(function (key) {
        if (skip[String(key).toLowerCase()]) return;
        var value = src[key];
        if (value == null) return;
        out[key] = String(value);
    });
    return out;
}

function decodeBase64(str) {
    var bin = atob(String(str));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function forwardRequest(payload) {
    var target;
    try {
        target = new URL(String(payload && payload.url ? payload.url : ""));
    } catch (e) {
        throw new Error("无效的 URL：" + String(payload && payload.url));
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
        throw new Error("仅支持 http / https，当前为 " + target.protocol);
    }
    if (isBlockedHost(target.hostname)) {
        throw new Error("出于安全考虑，代理不允许访问内网地址：" + target.hostname);
    }

    var method = String((payload && payload.method) || "GET").toUpperCase();
    var headers = headerEntriesForForward(payload && payload.headers);
    var body;
    if (method !== "GET" && method !== "HEAD" && payload && payload.body != null && payload.body !== "") {
        body = payload.bodyEncoding === "base64" ? decodeBase64(payload.body) : String(payload.body);
    }

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    var res;
    try {
        res = await fetch(target.toString(), {
            method: method,
            headers: headers,
            body: body,
            redirect: "follow",
            signal: controller.signal
        });
    } catch (err) {
        if (err && err.name === "AbortError") {
            throw new Error("请求超时（>" + Math.round(TIMEOUT_MS / 1000) + "s）：" + target.toString());
        }
        throw new Error("代理转发失败：" + (err && err.message ? err.message : String(err)));
    } finally {
        clearTimeout(timer);
    }

    var buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_RESPONSE_BYTES) {
        throw new Error("响应体过大（" + Math.round(buf.byteLength / 1024) + "KB，上限 " + Math.round(MAX_RESPONSE_BYTES / 1024) + "KB），已拒绝转发");
    }

    var contentType = res.headers.get("content-type") || "";
    var text = new TextDecoder("utf-8").decode(buf);
    var body2 = text;
    var trimmed = text.trim();
    if (/json/i.test(contentType) || trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
        try { body2 = JSON.parse(trimmed); } catch (e) { /* 保持原始文本 */ }
    }

    return {
        status: res.status,
        headers: headersToObject(res.headers),
        contentType: contentType,
        body: body2,
        finalUrl: res.url || target.toString(),
        redirected: !!res.redirected
    };
}

export async function onRequest(context) {
    var request = context.request;
    var method = request.method.toUpperCase();

    if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 探活：前端用它判断「当前站点到底有没有服务端代理」，不再靠协议猜。
    if (method === "GET" || method === "HEAD") {
        return jsonResponse({ ok: true, service: "tool-nav-proxy", maxResponseKb: MAX_RESPONSE_BYTES / 1024 });
    }

    if (method !== "POST") {
        return jsonResponse({ error: "仅支持 GET / POST / OPTIONS，收到 " + method }, 405);
    }

    var payload;
    try {
        payload = JSON.parse(await request.text() || "{}");
    } catch (e) {
        return jsonResponse({ error: "请求体不是合法 JSON" }, 400);
    }
    if (!payload || !payload.url) {
        return jsonResponse({ error: "缺少 url" }, 400);
    }

    try {
        return jsonResponse(await forwardRequest(payload));
    } catch (err) {
        return jsonResponse({ error: err && err.message ? err.message : String(err) }, 502);
    }
}
