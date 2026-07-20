/**
 * file:// 离线可用：挂到 window.MdDocx，避免 Chrome 拦截 file:// 下的 ESM import()
 */
import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;

import {
    createMarkdownIt,
    convertMarkdownToDocxBlob,
    convertManyToZip,
    renderMarkdownHtml,
    JSZip,
} from "./md-docx.mjs";

var g = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self;
g.MdDocx = {
    createMarkdownIt: createMarkdownIt,
    convertMarkdownToDocxBlob: convertMarkdownToDocxBlob,
    convertManyToZip: convertManyToZip,
    renderMarkdownHtml: renderMarkdownHtml,
    JSZip: JSZip,
};
