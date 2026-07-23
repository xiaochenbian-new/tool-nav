/**
 * Shared find helpers for tool pages (Ctrl+F).
 * Avoids freezing on huge / single-line documents by:
 * - incremental next/prev (no full match list)
 * - capped match counting
 * - capped CodeMirror / HTML highlights
 * - safe horizontal scroll estimates for mega-lines
 */
(function (root) {
    "use strict";

    var MAX_HIGHLIGHT = 80;
    var MAX_COUNT = 999;
    var HUGE_TEXT = 180000;
    var HUGE_LINE_COL = 8000;
    var MEASURE_EXACT_COLS = 2500;

    function escapeRegExp(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function stepLen(needle) {
        return Math.max(1, String(needle).length);
    }

    function isHugeText(text) {
        return !text ? false : text.length >= HUGE_TEXT;
    }

    /** Next match with start >= fromIndex. Does not scan the whole document. */
    function findNext(text, needle, fromIndex, caseSens) {
        if (!needle || text == null || text === "") return null;
        var from = Math.max(0, fromIndex | 0);
        var idx = -1;
        if (caseSens) {
            idx = text.indexOf(needle, from);
        } else {
            var re = new RegExp(escapeRegExp(needle), "gi");
            re.lastIndex = from;
            var m = re.exec(text);
            idx = m ? m.index : -1;
        }
        if (idx < 0) return null;
        return { start: idx, end: idx + needle.length };
    }

    /**
     * Previous match with end <= fromIndex (start < fromIndex).
     * Uses chunked reverse scan for case-insensitive to avoid text.toLowerCase() on mega strings.
     */
    function findPrev(text, needle, fromIndex, caseSens) {
        if (!needle || text == null || text === "") return null;
        var from = Math.min(text.length, Math.max(0, fromIndex | 0));
        if (from <= 0) return null;
        var nLen = needle.length;
        var idx = -1;

        if (caseSens) {
            idx = text.lastIndexOf(needle, Math.max(0, from - 1));
            while (idx >= 0 && idx + nLen > from) {
                if (idx === 0) {
                    idx = -1;
                    break;
                }
                idx = text.lastIndexOf(needle, idx - 1);
            }
        } else {
            var chunk = 262144;
            var end = from;
            var nLower = needle.toLowerCase();
            while (end > 0 && idx < 0) {
                var start = Math.max(0, end - chunk);
                var sliceStart = Math.max(0, start - nLen + 1);
                var slice = text.slice(sliceStart, end).toLowerCase();
                var local = slice.lastIndexOf(nLower);
                while (local >= 0) {
                    var abs = sliceStart + local;
                    if (abs < from && abs + nLen <= from) {
                        idx = abs;
                        break;
                    }
                    if (abs < from && abs + nLen > from) {
                        // overlapping current selection — keep looking left
                        if (local === 0) break;
                        local = slice.lastIndexOf(nLower, local - 1);
                        continue;
                    }
                    if (local === 0) break;
                    local = slice.lastIndexOf(nLower, local - 1);
                }
                if (idx >= 0) break;
                if (start === 0) break;
                end = start;
            }
        }
        if (idx < 0) return null;
        return { start: idx, end: idx + nLen };
    }

    /** Count matches up to `limit` (early exit). */
    function countMatches(text, needle, caseSens, limit) {
        var lim = limit == null ? MAX_COUNT : limit;
        if (isHugeText(text)) lim = Math.min(lim, 200);
        var out = { count: 0, truncated: false };
        if (!needle || text == null || text === "") return out;
        var step = stepLen(needle);
        if (caseSens) {
            var pos = 0;
            while ((pos = text.indexOf(needle, pos)) !== -1) {
                out.count++;
                if (out.count > lim) {
                    out.count = lim;
                    out.truncated = true;
                    return out;
                }
                pos += step;
            }
        } else {
            var re = new RegExp(escapeRegExp(needle), "gi");
            var m;
            while ((m = re.exec(text))) {
                out.count++;
                if (out.count > lim) {
                    out.count = lim;
                    out.truncated = true;
                    return out;
                }
                if (!m[0].length) re.lastIndex++;
            }
        }
        return out;
    }

    /** How many matches start before `offset` (capped). */
    function countMatchesBefore(text, needle, caseSens, offset, limit) {
        var lim = limit == null ? MAX_COUNT : limit;
        if (isHugeText(text)) lim = Math.min(lim, 200);
        var out = { count: 0, truncated: false };
        if (!needle || text == null || offset <= 0) return out;
        var step = stepLen(needle);
        if (caseSens) {
            var pos = 0;
            while ((pos = text.indexOf(needle, pos)) !== -1) {
                if (pos >= offset) break;
                out.count++;
                if (out.count > lim) {
                    out.count = lim;
                    out.truncated = true;
                    return out;
                }
                pos += step;
            }
        } else {
            var re = new RegExp(escapeRegExp(needle), "gi");
            var m;
            while ((m = re.exec(text))) {
                if (m.index >= offset) break;
                out.count++;
                if (out.count > lim) {
                    out.count = lim;
                    out.truncated = true;
                    return out;
                }
                if (!m[0].length) re.lastIndex++;
            }
        }
        return out;
    }

    /**
     * Collect up to maxN matches near `around` for highlighting.
     * Never walks the entire match set when the doc is huge.
     */
    function collectHighlights(text, needle, caseSens, around, maxN) {
        var res = [];
        if (!needle || text == null || text === "") return res;
        var max = maxN == null ? MAX_HIGHLIGHT : maxN;
        if (max <= 0) return res;
        around = Math.max(0, around | 0);

        // Prefer matches near the caret / selection (works for both normal and huge docs).
        var back = [];
        var cur = around;
        var guard = 0;
        var backBudget = Math.min(Math.floor(max / 2), isHugeText(text) ? 8 : Math.floor(max / 2));
        while (back.length < backBudget && guard++ < max + 5) {
            var prev = findPrev(text, needle, cur, caseSens);
            if (!prev) break;
            back.push(prev);
            cur = prev.start;
        }
        back.reverse();

        var forward = [];
        cur = around;
        var at = findNext(text, needle, Math.max(0, around - needle.length), caseSens);
        if (at && at.start <= around && at.end > around) cur = at.end;
        guard = 0;
        while (forward.length < max - back.length && guard++ < max + 5) {
            var nxt = findNext(text, needle, cur, caseSens);
            if (!nxt) break;
            forward.push(nxt);
            cur = nxt.end;
        }
        return back.concat(forward).slice(0, max);
    }

    /** Legacy-compatible collector with hard cap (replaces unbounded getMatchPositions). */
    function getMatchPositions(text, needle, caseSens, limit) {
        return collectHighlights(text, needle, caseSens, 0, limit == null ? MAX_HIGHLIGHT : limit);
    }

    function formatCountLabel(index1BasedOrDash, total, truncated) {
        var right = truncated ? total + "+" : String(total);
        return (index1BasedOrDash == null ? "—" : index1BasedOrDash) + " / " + right;
    }

    /**
     * Estimate pixel x for a column on a possibly mega-length line.
     * Avoids canvas.measureText on multi-MB strings (main freeze source).
     */
    function estimateColumnPixelX(ctx, lineText, col) {
        if (col <= 0) return 0;
        var len = lineText ? lineText.length : 0;
        var c = Math.min(col, len);
        if (c <= MEASURE_EXACT_COLS) {
            return ctx.measureText(lineText.slice(0, c)).width;
        }
        var sampleN = Math.min(200, len);
        var sample = lineText.slice(0, sampleN);
        var sampleW = sampleN ? ctx.measureText(sample).width : ctx.measureText("M").width * sampleN;
        var avg = sampleN ? sampleW / sampleN : ctx.measureText("M").width;
        // refine with a mid-window sample for mixed CJK/ASCII
        if (c > sampleN && len > sampleN) {
            var midStart = Math.min(len - sampleN, Math.max(0, c - sampleN));
            var mid = lineText.slice(midStart, midStart + sampleN);
            var midW = ctx.measureText(mid).width;
            avg = (avg + midW / sampleN) / 2;
        }
        return avg * c;
    }

    function shouldSkipFullHighlights(text) {
        return isHugeText(text);
    }

    function shouldApproxHorizontalScroll(col) {
        return col >= HUGE_LINE_COL;
    }

    root.ToolFind = {
        MAX_HIGHLIGHT: MAX_HIGHLIGHT,
        MAX_COUNT: MAX_COUNT,
        HUGE_TEXT: HUGE_TEXT,
        escapeRegExp: escapeRegExp,
        findNext: findNext,
        findPrev: findPrev,
        countMatches: countMatches,
        countMatchesBefore: countMatchesBefore,
        collectHighlights: collectHighlights,
        getMatchPositions: getMatchPositions,
        formatCountLabel: formatCountLabel,
        estimateColumnPixelX: estimateColumnPixelX,
        shouldSkipFullHighlights: shouldSkipFullHighlights,
        shouldApproxHorizontalScroll: shouldApproxHorizontalScroll,
        isHugeText: isHugeText,
    };
})(typeof window !== "undefined" ? window : globalThis);
