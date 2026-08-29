/**
 * file:// 离线可用：挂到 window.WordToMarkdown
 * 转换链路：.docx → HTML (mammoth) → Markdown (turndown)
 */
import mammoth from "mammoth";
import TurndownService from "turndown";

var g = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self;

var turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
});

/* ---------- Turndown 规则增强 ---------- */

// 保留表格结构
turndownService.addRule("table", {
    filter: ["table"],
    replacement: function (content, node) {
        var rows = [];
        var allRows = node.querySelectorAll("tr");
        for (var i = 0; i < allRows.length; i++) {
            var cells = [];
            var tdList = allRows[i].querySelectorAll("th, td");
            for (var j = 0; j < tdList.length; j++) {
                cells.push(tdList[j].textContent.replace(/\|/g, "\\|").trim());
            }
            rows.push(cells);
        }
        if (rows.length === 0) return content;
        var colCount = rows[0].length;
        var headerRow = "| " + rows[0].join(" | ") + " |";
        var separator = "| " + rows[0].map(function () { return "---"; }).join(" | ") + " |";
        var bodyRows = [];
        for (var k = 1; k < rows.length; k++) {
            while (rows[k].length < colCount) rows[k].push("");
            bodyRows.push("| " + rows[k].join(" | ") + " |");
        }
        return "\n\n" + headerRow + "\n" + separator + (bodyRows.length ? "\n" + bodyRows.join("\n") : "") + "\n\n";
    },
});

// 处理任务列表
turndownService.addRule("taskListItem", {
    filter: function (node) {
        return (
            node.nodeName === "LI" &&
            node.querySelector('input[type="checkbox"]')
        );
    },
    replacement: function (content, node) {
        var checkbox = node.querySelector('input[type="checkbox"]');
        var checked = checkbox && checkbox.checked;
        // 清理开头的换行和空白
        var text = content.replace(/^\n+/, "").replace(/\n+$/, "\n");
        return "- " + (checked ? "[x] " : "[ ] ") + text.trim() + "\n";
    },
});

// 移除空链接
turndownService.addRule("emptyLinks", {
    filter: function (node) {
        return node.nodeName === "A" && (!node.textContent || !node.textContent.trim()) && !node.querySelector("img");
    },
    replacement: function () {
        return "";
    },
});

g.WordToMarkdown = {
    mammoth: mammoth,
    turndownService: turndownService,

    /**
     * 将 .docx 的 ArrayBuffer 转为 Markdown
     * @param {ArrayBuffer} arrayBuffer - docx 文件内容
     * @param {object} [options]
     * @returns {Promise<{markdown: string, html: string, messages: Array}>}
     */
    convert: async function (arrayBuffer, options) {
        options = options || {};
        var styleMap = options.styleMap || [];

        // Step 1: docx → HTML
        var result = await mammoth.convertToHtml(
            { arrayBuffer: arrayBuffer, styleMap: styleMap },
            {
                convertImage: mammoth.images.dataUri,
            }
        );

        var html = result.value;
        var messages = result.messages || [];

        // Step 2: HTML → Markdown
        var markdown = turndownService.turndown(html);

        // 后处理：清理多余空行
        markdown = markdown
            .replace(/\n{4,}/g, "\n\n\n")
            .replace(/^\s+/, "")
            .replace(/\s+$/, "\n");

        return {
            markdown: markdown,
            html: html,
            messages: messages,
        };
    },

    /**
     * 从 File 对象转换
     * @param {File} file
     * @returns {Promise<{markdown: string, html: string, messages: Array}>}
     */
    convertFile: async function (file) {
        var arrayBuffer = await file.arrayBuffer();
        return g.WordToMarkdown.convert(arrayBuffer);
    },
};
