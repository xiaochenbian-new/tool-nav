import * as mod from "chinese-simple2traditional";
import * as enh from "chinese-simple2traditional/enhance";

if (typeof enh.setupEnhance === "function") {
    enh.setupEnhance();
}

export const toTraditional = mod.toTraditional;
export const toSimplified = mod.toSimplified;
