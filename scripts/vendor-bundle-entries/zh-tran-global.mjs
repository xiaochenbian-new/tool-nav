import { toTraditional, toSimplified } from "chinese-simple2traditional";
import * as enh from "chinese-simple2traditional/enhance";

if (typeof enh.setupEnhance === "function") {
    enh.setupEnhance();
}

var g = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self;
g._zhTran = { toTraditional: toTraditional, toSimplified: toSimplified };
