/**
 * Cloudflare Pages：默认会把 /foo.html 308 到 /foo，且 Location 对非 ASCII 路径会乱码。
 * 在进静态资源层之前把 *.html 改写成无后缀路径，直接 200 返回，避开坏重定向。
 */
function rewriteHtmlPath(pathname) {
    if (!pathname || !/\.html$/i.test(pathname)) return null;
    var next = pathname.replace(/\.html$/i, "");
    if (/\/index$/i.test(next)) {
        next = next.replace(/\/index$/i, "/");
    }
    if (!next) next = "/";
    return next;
}

export async function onRequest(context) {
    var url = new URL(context.request.url);
    var rewritten = rewriteHtmlPath(url.pathname);
    if (!rewritten) {
        return context.next();
    }
    url.pathname = rewritten;
    return context.next(url.toString());
}
