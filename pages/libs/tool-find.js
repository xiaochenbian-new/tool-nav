/**
 * Shared find helpers for tool pages (Ctrl+F).
 * Supports case / whole-word (精准匹配) / regex.
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
    var WORD_CLASS = "A-Za-z0-9_\\u4e00-\\u9fff";

    function escapeRegExp(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function normalizeOpts(caseSensOrOpts) {
        if (caseSensOrOpts && typeof caseSensOrOpts === "object") {
            return {
                caseSens: !!caseSensOrOpts.caseSens,
                wholeWord: !!caseSensOrOpts.wholeWord,
                regex: !!caseSensOrOpts.regex,
            };
        }
        return { caseSens: !!caseSensOrOpts, wholeWord: false, regex: false };
    }

    function stepLen(matchLen) {
        return Math.max(1, matchLen | 0);
    }

    function isHugeText(text) {
        return !text ? false : text.length >= HUGE_TEXT;
    }

    /** Build a global RegExp for searching. Throws on invalid regex pattern. */
    function buildSearchRegExp(needle, opts) {
        opts = normalizeOpts(opts);
        var source = opts.regex ? String(needle) : escapeRegExp(needle);
        if (opts.wholeWord) {
            source =
                "(?<![" +
                WORD_CLASS +
                "])(?:" +
                source +
                ")(?![" +
                WORD_CLASS +
                "])";
        }
        return new RegExp(source, opts.caseSens ? "g" : "gi");
    }

    function tryBuildSearchRegExp(needle, opts) {
        if (needle == null || needle === "") return null;
        try {
            return buildSearchRegExp(needle, opts);
        } catch (e) {
            return null;
        }
    }

    /** Whether selected text is one full match of the current find pattern. */
    function selectionMatches(selected, needle, opts) {
        if (!needle || selected == null || selected === "") return false;
        opts = normalizeOpts(opts);
        try {
            var source = opts.regex ? String(needle) : escapeRegExp(needle);
            if (opts.wholeWord) {
                // Selection is already the matched token; just test full equality to pattern.
            }
            var re = new RegExp("^(?:" + source + ")$", opts.caseSens ? "" : "i");
            return re.test(String(selected));
        } catch (e) {
            return false;
        }
    }

    function replaceAll(text, needle, repl, opts) {
        if (!needle || text == null) return text == null ? "" : String(text);
        var re = tryBuildSearchRegExp(needle, opts);
        if (!re) return String(text);
        return String(text).replace(re, function () {
            return repl == null ? "" : String(repl);
        });
    }

    /** Next match with start >= fromIndex. Does not scan the whole document. */
    function findNext(text, needle, fromIndex, caseSensOrOpts) {
        if (!needle || text == null || text === "") return null;
        var opts = normalizeOpts(caseSensOrOpts);
        var re = tryBuildSearchRegExp(needle, opts);
        if (!re) return null;
        var from = Math.max(0, fromIndex | 0);
        re.lastIndex = from;
        var m = re.exec(text);
        if (m && !m[0].length) {
            re.lastIndex = m.index + 1;
            m = re.exec(text);
        }
        if (!m) return null;
        return { start: m.index, end: m.index + m[0].length };
    }

    /**
     * Previous match with end <= fromIndex (start < fromIndex).
     * For huge docs, only searches a window before `from`.
     */
    function findPrev(text, needle, fromIndex, caseSensOrOpts) {
        if (!needle || text == null || text === "") return null;
        var opts = normalizeOpts(caseSensOrOpts);
        var re = tryBuildSearchRegExp(needle, opts);
        if (!re) return null;
        var from = Math.min(text.length, Math.max(0, fromIndex | 0));
        if (from <= 0) return null;

        var windowStart = 0;
        if (isHugeText(text)) {
            windowStart = Math.max(0, from - 262144);
        }
        re.lastIndex = windowStart;
        var last = null;
        var m;
        var guard = 0;
        var maxGuard = isHugeText(text) ? 5000 : text.length + 5;
        while ((m = re.exec(text)) && guard++ < maxGuard) {
            if (m.index >= from) break;
            if (!m[0].length) {
                re.lastIndex = m.index + 1;
                continue;
            }
            if (m.index + m[0].length <= from) {
                last = { start: m.index, end: m.index + m[0].length };
            }
        }
        return last;
    }

    /** Count matches up to `limit` (early exit). */
    function countMatches(text, needle, caseSensOrOpts, limit) {
        var opts = normalizeOpts(caseSensOrOpts);
        var lim = limit == null ? MAX_COUNT : limit;
        if (isHugeText(text)) lim = Math.min(lim, 200);
        var out = { count: 0, truncated: false };
        if (!needle || text == null || text === "") return out;
        var re = tryBuildSearchRegExp(needle, opts);
        if (!re) return out;
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
        return out;
    }

    /** How many matches start before `offset` (capped). */
    function countMatchesBefore(text, needle, caseSensOrOpts, offset, limit) {
        var opts = normalizeOpts(caseSensOrOpts);
        var lim = limit == null ? MAX_COUNT : limit;
        if (isHugeText(text)) lim = Math.min(lim, 200);
        var out = { count: 0, truncated: false };
        if (!needle || text == null || offset <= 0) return out;
        var re = tryBuildSearchRegExp(needle, opts);
        if (!re) return out;
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
        return out;
    }

    /**
     * Collect up to maxN matches near `around` for highlighting.
     * Never walks the entire match set when the doc is huge.
     */
    function collectHighlights(text, needle, caseSensOrOpts, around, maxN) {
        var opts = normalizeOpts(caseSensOrOpts);
        var res = [];
        if (!needle || text == null || text === "") return res;
        var max = maxN == null ? MAX_HIGHLIGHT : maxN;
        if (max <= 0) return res;
        around = Math.max(0, around | 0);

        var back = [];
        var cur = around;
        var guard = 0;
        var backBudget = Math.min(Math.floor(max / 2), isHugeText(text) ? 8 : Math.floor(max / 2));
        while (back.length < backBudget && guard++ < max + 5) {
            var prev = findPrev(text, needle, cur, opts);
            if (!prev) break;
            back.push(prev);
            cur = prev.start;
        }
        back.reverse();

        var forward = [];
        cur = around;
        var at = findNext(text, needle, Math.max(0, around - 1), opts);
        if (at && at.start <= around && at.end > around) cur = at.end;
        guard = 0;
        while (forward.length < max - back.length && guard++ < max + 5) {
            var nxt = findNext(text, needle, cur, opts);
            if (!nxt) break;
            forward.push(nxt);
            cur = nxt.end;
        }
        return back.concat(forward).slice(0, max);
    }

    /** Legacy-compatible collector with hard cap (replaces unbounded getMatchPositions). */
    function getMatchPositions(text, needle, caseSensOrOpts, limit) {
        return collectHighlights(text, needle, caseSensOrOpts, 0, limit == null ? MAX_HIGHLIGHT : limit);
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
        normalizeOpts: normalizeOpts,
        buildSearchRegExp: buildSearchRegExp,
        selectionMatches: selectionMatches,
        replaceAll: replaceAll,
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
