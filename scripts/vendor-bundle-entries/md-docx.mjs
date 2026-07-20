/**
 * Markdown → Word 离线 bundle：markdown-it + docx + jszip
 */
import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;

import MarkdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTaskLists from "markdown-it-task-lists";
import {
    AlignmentType,
    Bookmark,
    BorderStyle,
    Document,
    ExternalHyperlink,
    HeadingLevel,
    ImageRun,
    ImportedXmlComponent,
    InternalHyperlink,
    LevelFormat,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    convertInchesToTwip,
} from "docx";
import { mml2omml } from "mathml2omml";
import JSZip from "jszip";

var FONT = "Microsoft YaHei";
var FONT_CODE = "Consolas";
var COLOR_TEXT = "1F2A44";
var COLOR_MUTED = "5A6A85";
var HEADING_SIZES = { 1: 36, 2: 32, 3: 28, 4: 26, 5: 24, 6: 22 };
var HEADING_LEVELS = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
};
/** 转换期间注入的 KaTeX（页面已加载 window.katex） */
var activeKatex = null;

function mathPlugin(md) {
    function mathBlock(state, startLine, endLine, silent) {
        var pos = state.bMarks[startLine] + state.tShift[startLine];
        var max = state.eMarks[startLine];
        if (pos + 2 > max) return false;
        if (state.src.slice(pos, pos + 2) !== "$$") return false;
        var first = state.src.slice(pos + 2, max).trim();
        var next = startLine;
        var content = "";
        if (first.endsWith("$$") && first.length > 2) {
            content = first.slice(0, -2).trim();
        } else {
            if (first) content = first + "\n";
            for (next = startLine + 1; next < endLine; next++) {
                var lineStart = state.bMarks[next] + state.tShift[next];
                var lineEnd = state.eMarks[next];
                var line = state.src.slice(lineStart, lineEnd);
                if (line.trim().endsWith("$$")) {
                    content += line.trim().slice(0, -2);
                    break;
                }
                content += line + "\n";
            }
            if (next >= endLine) return false;
        }
        if (silent) return true;
        var token = state.push("math_block", "math", 0);
        token.content = content.trim();
        token.map = [startLine, next + 1];
        state.line = next + 1;
        return true;
    }

    function mathInline(state, silent) {
        var start = state.pos;
        if (state.src.charCodeAt(start) !== 0x24 /* $ */) return false;
        if (state.src.charCodeAt(start + 1) === 0x24) return false;
        var end = start + 1;
        while (end < state.posMax) {
            if (state.src.charCodeAt(end) === 0x24 && state.src.charCodeAt(end - 1) !== 0x5c) break;
            end++;
        }
        if (end >= state.posMax || end === start + 1) return false;
        if (!silent) {
            var token = state.push("math_inline", "math", 0);
            token.content = state.src.slice(start + 1, end);
        }
        state.pos = end + 1;
        return true;
    }

    md.block.ruler.before("fence", "math_block", mathBlock, { alt: ["paragraph", "reference", "blockquote", "list"] });
    md.inline.ruler.before("escape", "math_inline", mathInline);
}

function createMarkdownIt() {
    var md = new MarkdownIt({
        html: false,
        linkify: true,
        typographer: false,
        // 单个换行即换行，更符合中文编辑习惯（否则相邻两行会被合成一段）
        breaks: true,
    });
    md.use(markdownItFootnote);
    md.use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true });
    md.use(mathPlugin);
    return md;
}

/** 规范化常见全角列表符号，避免列表识别失败 */
function normalizeMarkdownSource(src) {
    if (!src) return "";
    var s = String(src)
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/^([ \t]*)[•●○◦﹒．][ \t]+/gm, "$1- ")
        .replace(/^([ \t]*)[－—–][ \t]+/gm, "$1- ");
    // 列表项后紧跟图片时补空行，避免图片被 CommonMark 吞进列表项
    s = s.replace(/(\n[ \t]*[-*+][ \t]+[^\n]*)\n(!\[[^\]]*\]\()/g, "$1\n\n$2");
    s = s.replace(/(\n[ \t]*\d+\.[ \t]+[^\n]*)\n(!\[[^\]]*\]\()/g, "$1\n\n$2");
    return s;
}

function textOfTokens(tokens, i, endType) {
    var parts = [];
    for (var j = i; j < tokens.length; j++) {
        var t = tokens[j];
        if (t.type === endType) break;
        if (t.type === "inline" && t.children) {
            t.children.forEach(function (c) {
                if (c.type === "text" || c.type === "code_inline") parts.push(c.content);
                else if (c.type === "math_inline") parts.push(c.content);
            });
        } else if (t.content) {
            parts.push(t.content);
        }
    }
    return parts.join("");
}

function decodeDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return null;
    var cleaned = dataUrl.replace(/\s+/g, "");
    var m = /^data:(image\/[a-zA-Z0-9+.-]+)(;[^,]*)?;base64,(.+)$/i.exec(cleaned);
    if (!m) return null;
    var mime = m[1].toLowerCase();
    var b64 = m[3];
    try {
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var type = "png";
        if (mime.indexOf("jpeg") >= 0 || mime.indexOf("jpg") >= 0) type = "jpg";
        else if (mime.indexOf("gif") >= 0) type = "gif";
        else if (mime.indexOf("bmp") >= 0) type = "bmp";
        else if (mime.indexOf("webp") >= 0 || mime.indexOf("svg") >= 0) type = "png"; // 后面转成 png
        return { type: type, data: bytes, mime: mime, needRaster: /webp|svg/i.test(mime) };
    } catch (e) {
        return null;
    }
}

function sniffImageType(bytes) {
    if (!bytes || bytes.length < 4) return null;
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "webp";
    return null;
}

function rasterizeToPng(bytes, mime) {
    return new Promise(function (resolve) {
        try {
            var blob = new Blob([bytes], { type: mime || "image/png" });
            var url = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function () {
                try {
                    var canvas = document.createElement("canvas");
                    canvas.width = img.naturalWidth || 1;
                    canvas.height = img.naturalHeight || 1;
                    var ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob(function (out) {
                        URL.revokeObjectURL(url);
                        if (!out) {
                            resolve(null);
                            return;
                        }
                        out.arrayBuffer().then(function (buf) {
                            resolve({
                                type: "png",
                                data: new Uint8Array(buf),
                                width: canvas.width,
                                height: canvas.height,
                            });
                        });
                    }, "image/png");
                } catch (e) {
                    URL.revokeObjectURL(url);
                    resolve(null);
                }
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                resolve(null);
            };
            img.src = url;
        } catch (e2) {
            resolve(null);
        }
    });
}

function loadImageBytes(src, imageMap) {
    return new Promise(function (resolve) {
        if (!src) {
            resolve(null);
            return;
        }

        // 短引用 mdimg:xxx → 真实 dataURL / 已解码对象
        if (imageMap) {
            var mapped = imageMap[src];
            if (!mapped && /^mdimg:/i.test(src)) mapped = imageMap[src.slice(6)];
            if (mapped) {
                if (typeof mapped === "string") {
                    src = mapped;
                } else if (mapped.data) {
                    resolve(mapped);
                    return;
                } else if (mapped.dataUrl) {
                    src = mapped.dataUrl;
                }
            }
        }

        function finish(bytes, mime, forcedType) {
            var sniffed = sniffImageType(bytes);
            var type = forcedType || sniffed || "png";
            var needRaster = type === "webp" || (mime && /webp|svg/i.test(mime));
            if (needRaster) {
                rasterizeToPng(bytes, mime || "image/webp").then(function (r) {
                    resolve(r);
                });
                return;
            }
            if (type === "webp") type = "png";
            probeImageSize(bytes, mime || "image/" + type).then(function (size) {
                resolve({
                    type: type === "jpeg" ? "jpg" : type,
                    data: bytes,
                    width: size.width,
                    height: size.height,
                });
            });
        }

        if (/^data:image\//i.test(src)) {
            var d = decodeDataUrl(src);
            if (!d) {
                resolve(null);
                return;
            }
            if (d.needRaster) {
                rasterizeToPng(d.data, d.mime).then(resolve);
            } else {
                finish(d.data, d.mime, d.type);
            }
            return;
        }
        if (/^https?:\/\//i.test(src) || /^blob:/i.test(src)) {
            fetch(src)
                .then(function (r) {
                    return r.arrayBuffer().then(function (buf) {
                        var mime = (r.headers.get("content-type") || "image/png").split(";")[0].trim();
                        finish(new Uint8Array(buf), mime, null);
                    });
                })
                .catch(function () {
                    resolve(null);
                });
            return;
        }
        resolve(null);
    });
}

function probeImageSize(bytes, mime) {
    return new Promise(function (resolve) {
        var blob = new Blob([bytes], { type: mime || "image/png" });
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
            var w = img.naturalWidth || 400;
            var h = img.naturalHeight || 300;
            URL.revokeObjectURL(url);
            resolve({ width: w, height: h });
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            resolve({ width: 400, height: 300 });
        };
        img.src = url;
    });
}

function fitImageSize(w, h, maxW) {
    maxW = maxW || 560;
    if (!w || !h) return { width: maxW, height: Math.round(maxW * 0.75) };
    if (w <= maxW) return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
    var ratio = maxW / w;
    return { width: maxW, height: Math.max(1, Math.round(h * ratio)) };
}

async function makeImageParagraph(src, alt, imageMap) {
    var img = await loadImageBytes(src, imageMap);
    if (!img || !img.data || !img.data.length) {
        return new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [run("[无法嵌入图片: " + (alt || src || "").slice(0, 60) + "]", { color: "999999", italics: true })],
        });
    }
    var size = fitImageSize(img.width, img.height, 560);
    var type = img.type === "jpeg" ? "jpg" : img.type;
    if (["png", "jpg", "gif", "bmp"].indexOf(type) < 0) type = "png";
    try {
        return new Paragraph({
            spacing: { before: 140, after: 140 },
            alignment: AlignmentType.CENTER,
            children: [
                new ImageRun({
                    type: type,
                    data: img.data,
                    transformation: { width: size.width, height: size.height },
                    altText: {
                        title: alt || "image",
                        description: alt || "image",
                        name: (alt || "image").slice(0, 40),
                    },
                }),
            ],
        });
    } catch (e) {
        return new Paragraph({
            children: [run("[图片嵌入失败: " + (alt || "") + "]", { color: "999999", italics: true })],
        });
    }
}

/**
 * 把 inline 子节点拆成「文字段落 + 图片段落」，列表项里的图也能导出。
 */
async function inlineChildrenToBlocks(inlineChildren, imageMap, textParaOpts) {
    textParaOpts = textParaOpts || {};
    var blocks = [];
    var textBuf = [];

    async function flushText(extraOpts) {
        if (!textBuf.length) return;
        var opts = Object.assign({}, textParaOpts, extraOpts || {});
        var parts = inlineChildrenToParagraphs(textBuf, opts);
        blocks.push.apply(blocks, parts);
        textBuf = [];
    }

    var kids = inlineChildren || [];
    for (var k = 0; k < kids.length; k++) {
        var c = kids[k];
        if (c.type === "image") {
            var firstImageInItem = textParaOpts && textParaOpts.numbering && !textParaOpts._imageSeen;
            await flushText(firstImageInItem ? null : { numbering: undefined });
            if (textParaOpts) textParaOpts._imageSeen = true;
            var srcAttr = c.attrs && c.attrs.find(function (a) {
                return a[0] === "src";
            });
            var src = srcAttr ? srcAttr[1] : "";
            var alt = (c.content || "").trim() || "image";
            blocks.push(await makeImageParagraph(src, alt, imageMap));
        } else {
            textBuf.push(c);
        }
    }
    await flushText();
    return blocks;
}

/** 将 LaTeX 转为 Word 原生 OMML 公式组件；失败返回 null */
function latexToDocxMath(tex, displayMode) {
    var katexApi = activeKatex;
    if (!katexApi || !tex) return null;
    try {
        var html = katexApi.renderToString(tex, {
            throwOnError: false,
            displayMode: !!displayMode,
            output: "mathml",
        });
        var m = html && html.match(/<math[\s\S]*?<\/math>/);
        if (!m) return null;
        var mml = m[0]
            .replace(/<annotation[\s\S]*?<\/annotation>/g, "")
            .replace(/<\/?semantics>/g, "");
        var omml = mml2omml(mml);
        // 修复 nary 混合内容：后续符号被塞进 m:e 会导致导入丢子节点
        omml = omml.replace(/<\/m:r>([^<]+)<\/m:e><\/m:nary>/g, function (_, text) {
            return (
                '</m:r></m:e></m:nary><m:r><m:t xml:space="preserve">' +
                text +
                "</m:t></m:r>"
            );
        });
        omml = omml.replace(/\sxmlns:(?:m|w)="[^"]*"/g, "");
        omml = omml.replace(
            /^<m:oMath/,
            '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'
        );
        var wrapper = ImportedXmlComponent.fromXmlString(omml);
        var kids = (wrapper.root || []).filter(function (c) {
            return c && typeof c === "object" && c.rootKey;
        });
        return kids.length === 1 ? kids[0] : wrapper;
    } catch (e) {
        return null;
    }
}

function mathFallbackRun(tex) {
    return run(tex || "", { font: FONT_CODE, italics: true, size: 20, color: "5B2C6F" });
}

function run(text, opts) {
    opts = opts || {};
    var conf = {
        text: text == null ? "" : String(text),
        bold: !!opts.bold,
        italics: !!opts.italics,
        strike: !!opts.strike,
        font: opts.font || FONT,
        size: opts.size || 22,
    };
    if (opts.color) conf.color = opts.color;
    if (opts.highlight) conf.highlight = opts.highlight;
    if (opts.superScript) conf.superScript = true;
    if (opts.break) conf.break = opts.break;
    return new TextRun(conf);
}

function inlineToRunsStyled(children) {
    var runs = [];
    var stack = { bold: false, italics: false, strike: false };
    if (!children) return runs;

    function flushText(text) {
        if (text == null || text === "") return;
        runs.push(
            run(text, {
                bold: stack.bold,
                italics: stack.italics,
                strike: stack.strike,
                color: COLOR_TEXT,
            })
        );
    }

    for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c.type === "text") {
            flushText(c.content);
        } else if (c.type === "softbreak" || c.type === "hardbreak") {
            // 由上层拆成独立段落，这里忽略
        } else if (c.type === "code_inline") {
            runs.push(run(c.content, { font: FONT_CODE, size: 20, color: "C7254E" }));
        } else if (c.type === "strong_open") {
            stack.bold = true;
        } else if (c.type === "strong_close") {
            stack.bold = false;
        } else if (c.type === "em_open") {
            stack.italics = true;
        } else if (c.type === "em_close") {
            stack.italics = false;
        } else if (c.type === "s_open") {
            stack.strike = true;
        } else if (c.type === "s_close") {
            stack.strike = false;
        } else if (c.type === "link_open") {
            var href = c.attrs && c.attrs.find(function (a) {
                return a[0] === "href";
            });
            href = href ? href[1] : "";
            var label = "";
            var j = i + 1;
            while (j < children.length && children[j].type !== "link_close") {
                if (children[j].type === "text") label += children[j].content;
                j++;
            }
            i = j;
            if (href) {
                runs.push(
                    new ExternalHyperlink({
                        children: [
                            new TextRun({
                                text: label || href,
                                font: FONT,
                                size: 22,
                                color: "2F6BFF",
                                underline: {},
                            }),
                        ],
                        link: href,
                    })
                );
            } else {
                flushText(label);
            }
        } else if (c.type === "image") {
            // 正常应由 inlineChildrenToBlocks 处理；兜底不输出误导性占位
        } else if (c.type === "math_inline") {
            var inlineMath = latexToDocxMath(c.content, false);
            runs.push(inlineMath || mathFallbackRun(c.content));
        } else if (c.type === "footnote_ref") {
            var n = c.meta && c.meta.id != null ? c.meta.id + 1 : "?";
            runs.push(run("[" + n + "]", { superScript: true, size: 16, color: "2F6BFF" }));
        }
    }
    return runs;
}

/** 按换行拆成多个 Word 段落，避免挤在一行或字符被拉开 */
function inlineChildrenToParagraphs(inlineChildren, paraOpts) {
    paraOpts = paraOpts || {};
    var groups = [];
    var cur = [];
    (inlineChildren || []).forEach(function (c) {
        if (c.type === "softbreak" || c.type === "hardbreak") {
            groups.push(cur);
            cur = [];
        } else {
            cur.push(c);
        }
    });
    groups.push(cur);

    var paras = [];
    groups.forEach(function (g) {
        if (!g.length) return;
        var runs = inlineToRunsStyled(g);
        if (!runs.length) return;
        paras.push(
            new Paragraph({
                spacing: paraOpts.spacing || { after: 120, line: 276 },
                indent: paraOpts.indent,
                border: paraOpts.border,
                numbering: paraOpts.numbering,
                alignment: paraOpts.alignment,
                shading: paraOpts.shading,
                children: runs,
            })
        );
    });
    if (!paras.length && paraOpts.numbering) {
        paras.push(
            new Paragraph({
                spacing: paraOpts.spacing || { after: 80, line: 276 },
                numbering: paraOpts.numbering,
                children: [run("")],
            })
        );
    }
    return paras;
}

function makeHeadingParagraph(level, title, bookmarkId) {
    var size = HEADING_SIZES[level] || 24;
    var heading = HEADING_LEVELS[level] || HeadingLevel.HEADING_1;
    var textRun = run(title, { bold: true, size: size, color: COLOR_TEXT, font: FONT });
    var kids = bookmarkId
        ? [new Bookmark({ id: bookmarkId, children: [textRun] })]
        : [textRun];
    return new Paragraph({
        heading: heading,
        spacing: { before: level === 1 ? 280 : 220, after: 120, line: 276 },
        children: kids,
    });
}

/** 打开即可见的静态目录（不依赖 Word「更新域」） */
function buildStaticTocParagraphs(headings) {
    var paras = [];
    paras.push(
        new Paragraph({
            spacing: { after: 120, line: 276 },
            children: [run("目录", { bold: true, size: 32, color: COLOR_TEXT, font: FONT })],
        })
    );
    headings.forEach(function (h) {
        var label = h.title || "";
        var linkChildren = [
            new TextRun({
                text: label,
                font: FONT,
                size: 20,
                color: "2F6BFF",
                underline: {},
            }),
        ];
        paras.push(
            new Paragraph({
                spacing: { after: 60, line: 276 },
                indent: { left: convertInchesToTwip(Math.max(0, (h.level || 1) - 1) * 0.22) },
                children: h.bookmarkId
                    ? [
                          new InternalHyperlink({
                              anchor: h.bookmarkId,
                              children: linkChildren,
                          }),
                      ]
                    : linkChildren,
            })
        );
    });
    paras.push(
        new Paragraph({
            border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, color: "DDDDDD", space: 1 },
            },
            spacing: { after: 240 },
            children: [run("")],
        })
    );
    return paras;
}

function buildHeadingParagraphStyles() {
    var styles = [];
    for (var level = 1; level <= 6; level++) {
        styles.push({
            id: "Heading" + level,
            name: "Heading " + level,
            basedOn: "Normal",
            next: "Normal",
            quickStyle: true,
            run: {
                size: HEADING_SIZES[level],
                bold: true,
                font: FONT,
                color: COLOR_TEXT,
            },
            paragraph: {
                spacing: {
                    before: level === 1 ? 280 : 200,
                    after: 120,
                    line: 276,
                },
                outlineLevel: level - 1,
            },
        });
    }
    return styles;
}

function collectHeadings(tokens) {
    var list = [];
    for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (t.type === "heading_open") {
            var level = parseInt(t.tag.slice(1), 10) || 1;
            var title = textOfTokens(tokens, i + 1, "heading_close");
            list.push({ level: level, title: title });
        }
    }
    return list;
}

async function tokensToDocxChildren(tokens, options) {
    var children = [];
    var imageMap = (options && options.imageMap) || {};
    var numberingState = (options && options.numberingState) || { configs: [], orderedSeq: 0 };
    var tocHeadings = (options && options.tocHeadings) || null;
    var tocHeadingCursor = 0;
    var i = 0;

    async function inlineImagesAsParagraphs(inlineToken) {
        return inlineChildrenToBlocks((inlineToken && inlineToken.children) || [], imageMap, {
            spacing: { after: 120, line: 276 },
        });
    }

    while (i < tokens.length) {
        var t = tokens[i];

        if (t.type === "heading_open") {
            var level = parseInt(t.tag.slice(1), 10) || 1;
            var title = textOfTokens(tokens, i + 1, "heading_close");
            var bookmarkId = null;
            if (tocHeadings && tocHeadingCursor < tocHeadings.length) {
                bookmarkId = tocHeadings[tocHeadingCursor].bookmarkId || null;
                tocHeadingCursor++;
            }
            children.push(makeHeadingParagraph(level, title, bookmarkId));
            while (i < tokens.length && tokens[i].type !== "heading_close") i++;
            i++;
            continue;
        }

        if (t.type === "paragraph_open") {
            var inline = tokens[i + 1];
            if (inline && inline.type === "inline") {
                var blocks = await inlineChildrenToBlocks(inline.children, imageMap, {
                    spacing: { after: 120, line: 276 },
                });
                if (!blocks.length) {
                    blocks = [
                        new Paragraph({
                            spacing: { after: 120, line: 276 },
                            children: [run("")],
                        }),
                    ];
                }
                children.push.apply(children, blocks);
            }
            while (i < tokens.length && tokens[i].type !== "paragraph_close") i++;
            i++;
            continue;
        }

        if (t.type === "bullet_list_open" || t.type === "ordered_list_open") {
            var ordered = t.type === "ordered_list_open";
            var listResult = await consumeList(tokens, i, ordered, 0, imageMap, numberingState);
            children.push.apply(children, listResult.paras);
            i = listResult.next;
            continue;
        }

        if (t.type === "blockquote_open") {
            var bq = await consumeBlockquote(tokens, i, imageMap);
            children.push.apply(children, bq.paras);
            i = bq.next;
            continue;
        }

        if (t.type === "fence" || t.type === "code_block") {
            var code = t.content || "";
            var lines = code.replace(/\n$/, "").split("\n");
            if (!lines.length) lines = [""];
            lines.forEach(function (line, idx) {
                children.push(
                    new Paragraph({
                        spacing: { before: idx === 0 ? 120 : 0, after: idx === lines.length - 1 ? 120 : 0, line: 240 },
                        shading: { type: ShadingType.CLEAR, fill: "F5F7FA" },
                        children: [run(line || " ", { font: FONT_CODE, size: 18, color: COLOR_TEXT })],
                    })
                );
            });
            i++;
            continue;
        }

        if (t.type === "math_block") {
            var blockMath = latexToDocxMath(t.content || "", true);
            children.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 160, after: 160, line: 276 },
                    children: [blockMath || mathFallbackRun(t.content || "")],
                })
            );
            i++;
            continue;
        }

        if (t.type === "hr") {
            children.push(
                new Paragraph({
                    border: {
                        bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 },
                    },
                    spacing: { before: 200, after: 200 },
                    children: [run("")],
                })
            );
            i++;
            continue;
        }

        if (t.type === "table_open") {
            var tableRes = consumeTable(tokens, i);
            children.push(tableRes.table);
            i = tableRes.next;
            continue;
        }

        if (t.type === "footnote_block_open") {
            children.push(
                new Paragraph({
                    spacing: { before: 300, after: 120 },
                    border: {
                        top: { style: BorderStyle.SINGLE, size: 6, color: "DDDDDD", space: 8 },
                    },
                    children: [run("脚注", { bold: true, size: 24, color: COLOR_TEXT })],
                })
            );
            i++;
            continue;
        }

        if (t.type === "footnote_open") {
            var fnId = t.meta && t.meta.id != null ? t.meta.id + 1 : "?";
            var fnInline = null;
            var j = i + 1;
            while (j < tokens.length && tokens[j].type !== "footnote_close") {
                if (tokens[j].type === "inline") fnInline = tokens[j];
                j++;
            }
            var fnRuns = [run("[" + fnId + "] ", { superScript: true, size: 16, color: "2F6BFF" })];
            if (fnInline) fnRuns = fnRuns.concat(inlineToRunsStyled(fnInline.children));
            children.push(
                new Paragraph({
                    spacing: { after: 80, line: 276 },
                    children: fnRuns,
                })
            );
            i = j + 1;
            continue;
        }

        i++;
    }

    return children;
}

function ensureBulletNumbering(numberingState) {
    if (numberingState.bulletReady) return "md-bullet";
    var levels = [];
    for (var level = 0; level < 6; level++) {
        levels.push({
            level: level,
            format: LevelFormat.BULLET,
            text: level % 2 === 0 ? "•" : "◦",
            alignment: AlignmentType.LEFT,
            style: {
                paragraph: {
                    indent: {
                        left: convertInchesToTwip(0.35 + level * 0.28),
                        hanging: convertInchesToTwip(0.22),
                    },
                },
            },
        });
    }
    numberingState.configs.push({ reference: "md-bullet", levels: levels });
    numberingState.bulletReady = true;
    return "md-bullet";
}

function ensureOrderedNumbering(numberingState) {
    numberingState.orderedSeq += 1;
    var ref = "md-ordered-" + numberingState.orderedSeq;
    var levels = [];
    for (var level = 0; level < 6; level++) {
        levels.push({
            level: level,
            format: LevelFormat.DECIMAL,
            text: "%" + (level + 1) + ".",
            alignment: AlignmentType.LEFT,
            style: {
                paragraph: {
                    indent: {
                        left: convertInchesToTwip(0.35 + level * 0.28),
                        hanging: convertInchesToTwip(0.28),
                    },
                },
            },
        });
    }
    numberingState.configs.push({ reference: ref, levels: levels });
    return ref;
}

async function consumeList(tokens, start, ordered, depth, imageMap, numberingState) {
    var paras = [];
    var i = start + 1;
    var listRef = ordered ? ensureOrderedNumbering(numberingState) : ensureBulletNumbering(numberingState);

    while (i < tokens.length) {
        var t = tokens[i];
        if (t.type === "bullet_list_close" || t.type === "ordered_list_close") {
            return { paras: paras, next: i + 1 };
        }
        if (t.type === "list_item_open") {
            var className = "";
            if (t.attrs) {
                t.attrs.forEach(function (a) {
                    if (a[0] === "class") className = a[1] || "";
                });
            }
            var isTask = className.indexOf("task-list-item") >= 0;
            var checked = false;
            var j = i + 1;
            var itemHadPara = false;
            while (j < tokens.length && tokens[j].type !== "list_item_close") {
                if (tokens[j].type === "paragraph_open") {
                    var inline = tokens[j + 1];
                    if (inline && inline.type === "inline") {
                        var kids = (inline.children || []).slice();
                        kids.forEach(function (c) {
                            if (c.type === "html_inline") {
                                if (/checkbox/i.test(c.content || "")) isTask = true;
                                if (/checked/i.test(c.content || "")) checked = true;
                            }
                        });
                        if (kids[0] && kids[0].type === "text" && /^\[[ xX]\]\s/.test(kids[0].content || "")) {
                            isTask = true;
                            checked = /^\[[xX]\]/.test(kids[0].content);
                            kids[0] = Object.assign({}, kids[0], {
                                content: kids[0].content.replace(/^\[[ xX]\]\s*/, ""),
                            });
                        }
                        var textKids = kids.filter(function (c) {
                            return c.type !== "html_inline";
                        });
                        var hasImage = textKids.some(function (c) {
                            return c.type === "image";
                        });
                        if (hasImage) {
                            var listParaOpts = {
                                spacing: { after: 60, line: 276 },
                            };
                            if (!isTask) {
                                listParaOpts.numbering = { reference: listRef, level: depth };
                            } else {
                                listParaOpts.indent = {
                                    left: convertInchesToTwip(0.35 + depth * 0.28),
                                    hanging: convertInchesToTwip(0.22),
                                };
                            }
                            // 先处理纯文字（带编号），图片单独成段
                            var onlyText = textKids.filter(function (c) {
                                return c.type !== "image";
                            });
                            var onlyImgs = textKids.filter(function (c) {
                                return c.type === "image";
                            });
                            if (onlyText.length) {
                                if (isTask) {
                                    var taskRuns = [run(checked ? "☑ " : "☐ ", { color: COLOR_TEXT })].concat(
                                        inlineToRunsStyled(
                                            onlyText.filter(function (c) {
                                                return c.type !== "softbreak" && c.type !== "hardbreak";
                                            })
                                        )
                                    );
                                    paras.push(
                                        new Paragraph({
                                            spacing: { after: 60, line: 276 },
                                            indent: listParaOpts.indent,
                                            children: taskRuns.length ? taskRuns : [run(checked ? "☑" : "☐")],
                                        })
                                    );
                                } else {
                                    var textBlocks = await inlineChildrenToBlocks(onlyText, imageMap, listParaOpts);
                                    paras.push.apply(paras, textBlocks);
                                }
                                itemHadPara = true;
                            } else if (!isTask) {
                                paras.push(
                                    new Paragraph({
                                        spacing: { after: 40, line: 276 },
                                        numbering: { reference: listRef, level: depth },
                                        children: [run("")],
                                    })
                                );
                                itemHadPara = true;
                            }
                            for (var ii = 0; ii < onlyImgs.length; ii++) {
                                var imgTok = onlyImgs[ii];
                                var srcAttr = imgTok.attrs && imgTok.attrs.find(function (a) {
                                    return a[0] === "src";
                                });
                                var src = srcAttr ? srcAttr[1] : "";
                                var alt = (imgTok.content || "").trim() || "image";
                                paras.push(await makeImageParagraph(src, alt, imageMap));
                                itemHadPara = true;
                            }
                        } else {
                            var lineGroups = [];
                            var curLine = [];
                            textKids.forEach(function (c) {
                                if (c.type === "softbreak" || c.type === "hardbreak") {
                                    lineGroups.push(curLine);
                                    curLine = [];
                                } else {
                                    curLine.push(c);
                                }
                            });
                            lineGroups.push(curLine);

                            lineGroups.forEach(function (g, gi) {
                                if (!g.length && gi > 0) return;
                                var runs = inlineToRunsStyled(g);
                                if (isTask && gi === 0) {
                                    runs = [run(checked ? "☑ " : "☐ ", { color: COLOR_TEXT })].concat(runs);
                                }
                                if (!runs.length) runs = [run("")];
                                var paraConf = {
                                    spacing: { after: 60, line: 276 },
                                    children: runs,
                                };
                                if (gi === 0 && !isTask) {
                                    paraConf.numbering = { reference: listRef, level: depth };
                                } else if (gi === 0 && isTask) {
                                    paraConf.indent = {
                                        left: convertInchesToTwip(0.35 + depth * 0.28),
                                        hanging: convertInchesToTwip(0.22),
                                    };
                                } else {
                                    paraConf.indent = {
                                        left: convertInchesToTwip(0.35 + depth * 0.28),
                                    };
                                }
                                paras.push(new Paragraph(paraConf));
                                itemHadPara = true;
                            });
                        }
                    }
                    while (j < tokens.length && tokens[j].type !== "paragraph_close") j++;
                } else if (tokens[j].type === "bullet_list_open" || tokens[j].type === "ordered_list_open") {
                    var nested = await consumeList(
                        tokens,
                        j,
                        tokens[j].type === "ordered_list_open",
                        depth + 1,
                        imageMap,
                        numberingState
                    );
                    paras.push.apply(paras, nested.paras);
                    j = nested.next - 1;
                }
                j++;
            }
            if (!itemHadPara) {
                paras.push(
                    new Paragraph({
                        spacing: { after: 60 },
                        numbering: isTask ? undefined : { reference: listRef, level: depth },
                        children: [run(isTask ? (checked ? "☑" : "☐") : "")],
                    })
                );
            }
            i = j + 1;
            continue;
        }
        i++;
    }
    return { paras: paras, next: i };
}

async function consumeBlockquote(tokens, start, imageMap) {
    var paras = [];
    var i = start + 1;
    while (i < tokens.length && tokens[i].type !== "blockquote_close") {
        if (tokens[i].type === "paragraph_open") {
            var inline = tokens[i + 1];
            var parts = inlineChildrenToParagraphs(inline && inline.type === "inline" ? inline.children : [], {
                spacing: { after: 100, line: 276 },
                indent: { left: convertInchesToTwip(0.2) },
                border: {
                    left: { style: BorderStyle.SINGLE, size: 18, color: "2F6BFF", space: 8 },
                },
            });
            if (!parts.length) {
                parts = [
                    new Paragraph({
                        spacing: { after: 100 },
                        indent: { left: convertInchesToTwip(0.2) },
                        border: {
                            left: { style: BorderStyle.SINGLE, size: 18, color: "2F6BFF", space: 8 },
                        },
                        children: [run("")],
                    }),
                ];
            }
            paras.push.apply(paras, parts);
            while (i < tokens.length && tokens[i].type !== "paragraph_close") i++;
        }
        i++;
    }
    return { paras: paras, next: i + 1 };
}

function consumeTable(tokens, start) {
    var rows = [];
    var i = start + 1;
    var currentCells = [];
    var rowIsHeader = false;

    function pushRow() {
        if (!currentCells.length) return;
        var colCount = currentCells.length;
        rows.push(
            new TableRow({
                children: currentCells.map(function (cellRuns) {
                    return new TableCell({
                        width: { size: Math.floor(9000 / colCount), type: WidthType.DXA },
                        shading: rowIsHeader ? { type: ShadingType.CLEAR, fill: "EAF1FF" } : undefined,
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                            bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                            left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                            right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                        },
                        children: [
                            new Paragraph({
                                children: cellRuns.length ? cellRuns : [run("")],
                            }),
                        ],
                    });
                }),
            })
        );
        currentCells = [];
        rowIsHeader = false;
    }

    while (i < tokens.length && tokens[i].type !== "table_close") {
        var t = tokens[i];
        if (t.type === "tr_open") {
            currentCells = [];
            rowIsHeader = false;
        } else if (t.type === "tr_close") {
            pushRow();
        } else if (t.type === "th_open") {
            rowIsHeader = true;
            var inlineTh = tokens[i + 1];
            var thText = inlineTh ? textFromInline(inlineTh) : "";
            currentCells.push([run(thText, { bold: true })]);
            while (i < tokens.length && tokens[i].type !== "th_close") i++;
        } else if (t.type === "td_open") {
            var inlineTd = tokens[i + 1];
            var tdText = inlineTd ? textFromInline(inlineTd) : "";
            currentCells.push([run(tdText)]);
            while (i < tokens.length && tokens[i].type !== "td_close") i++;
        }
        i++;
    }

    return {
        table: new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: rows,
        }),
        next: i + 1,
    };
}

function textFromInline(inline) {
    if (!inline || !inline.children) return inline && inline.content ? inline.content : "";
    return inline.children
        .map(function (c) {
            if (c.type === "text" || c.type === "code_inline") return c.content;
            return "";
        })
        .join("");
}

async function convertMarkdownToDocxBlob(markdown, options) {
    options = options || {};
    activeKatex =
        options.katex ||
        (typeof globalThis !== "undefined" && globalThis.katex) ||
        (typeof window !== "undefined" && window.katex) ||
        null;
    var md = createMarkdownIt();
    var src = normalizeMarkdownSource(markdown || "");
    var tokens = md.parse(src, {});
    var children = [];
    var numberingState = { configs: [], orderedSeq: 0, bulletReady: false };

    try {
        var tocHeadings = null;
        if (options.toc) {
            tocHeadings = collectHeadings(tokens).map(function (h, idx) {
                return {
                    level: h.level,
                    title: h.title,
                    bookmarkId: "_TocMd" + (idx + 1),
                };
            });
            if (tocHeadings.length) {
                children = children.concat(buildStaticTocParagraphs(tocHeadings));
            }
        }

        var body = await tokensToDocxChildren(tokens, {
            imageMap: options.imageMap,
            numberingState: numberingState,
            tocHeadings: tocHeadings,
        });
        children = children.concat(body);

        if (!children.length) {
            children.push(new Paragraph({ children: [run("")] }));
        }

        var docOptions = {
            styles: {
                default: {
                    document: {
                        run: {
                            font: FONT,
                            size: 22,
                            color: COLOR_TEXT,
                        },
                        paragraph: {
                            spacing: { line: 276, after: 80 },
                        },
                    },
                },
                paragraphStyles: buildHeadingParagraphStyles(),
            },
            sections: [
                {
                    properties: {
                        page: {
                            margin: {
                                top: convertInchesToTwip(1),
                                right: convertInchesToTwip(1),
                                bottom: convertInchesToTwip(1),
                                left: convertInchesToTwip(1),
                            },
                        },
                    },
                    children: children,
                },
            ],
        };
        if (numberingState.configs.length) {
            docOptions.numbering = { config: numberingState.configs };
        }

        var doc = new Document(docOptions);
        return Packer.toBlob(doc);
    } finally {
        activeKatex = null;
    }
}

function renderMarkdownHtml(markdown, katexApi) {
    var md = createMarkdownIt();
    md.renderer.rules.math_inline = function (tokens, idx) {
        var tex = tokens[idx].content;
        if (katexApi) {
            try {
                return katexApi.renderToString(tex, { throwOnError: false, displayMode: false });
            } catch (e) {
                /* fallthrough */
            }
        }
        return '<code class="md-math">' + md.utils.escapeHtml(tex) + "</code>";
    };
    md.renderer.rules.math_block = function (tokens, idx) {
        var tex = tokens[idx].content;
        if (katexApi) {
            try {
                return '<div class="md-math-block">' + katexApi.renderToString(tex, { throwOnError: false, displayMode: true }) + "</div>\n";
            } catch (e) {
                /* fallthrough */
            }
        }
        return '<pre class="md-math-block"><code>' + md.utils.escapeHtml(tex) + "</code></pre>\n";
    };
    return md.render(normalizeMarkdownSource(markdown || ""));
}

async function convertManyToZip(files, options) {
    var zip = new JSZip();
    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var blob = await convertMarkdownToDocxBlob(f.content, options);
        var name = (f.name || "document" + (i + 1)).replace(/\.md$/i, "") + ".docx";
        zip.file(name, blob);
    }
    return zip.generateAsync({ type: "blob" });
}

export {
    MarkdownIt,
    JSZip,
    createMarkdownIt,
    convertMarkdownToDocxBlob,
    convertManyToZip,
    renderMarkdownHtml,
};
