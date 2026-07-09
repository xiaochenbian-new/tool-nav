/**
 * Sheet 标签栏拖拽排序
 * 用法：ToolSheetTabsDrag.attach({ container, onReorder, isDragDisabled })
 */
(function (global) {
    "use strict";

    var DRAG_THRESHOLD = 6;
    var TAB_SELECTOR = ".json-sheet-tab[data-sheet-id]";

    function injectStyles() {
        if (document.getElementById("tool-sheet-tabs-drag-style")) return;
        var st = document.createElement("style");
        st.id = "tool-sheet-tabs-drag-style";
        st.textContent =
            ".json-sheet-tab.sheet-tab-dragging{opacity:.88;z-index:20;cursor:grabbing!important;box-shadow:0 4px 14px rgba(47,107,255,.28);transform:scale(1.02)}" +
            ".json-sheet-tab.sheet-tab-drop-before{box-shadow:inset 2px 0 0 #2f6bff}" +
            ".json-sheet-tab.sheet-tab-drop-after{box-shadow:inset -2px 0 0 #2f6bff}" +
            ".json-sheet-tab:not(.sheet-tab-dragging){cursor:grab}";
        (document.head || document.documentElement).appendChild(st);
    }

    function getTabs(container) {
        return Array.prototype.slice.call(container.querySelectorAll(TAB_SELECTOR));
    }

    function getTabIndex(container, tab) {
        var tabs = getTabs(container);
        for (var i = 0; i < tabs.length; i++) {
            if (tabs[i] === tab) return i;
        }
        return -1;
    }

    function clearDropMarkers(container) {
        var tabs = getTabs(container);
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.remove("sheet-tab-drop-before", "sheet-tab-drop-after");
        }
    }

    function getInsertPosition(container, draggingTab, clientX) {
        var tabs = getTabs(container).filter(function (t) {
            return t !== draggingTab;
        });
        if (!tabs.length) return { before: null, marker: null, side: null };

        var closest = { offset: Number.NEGATIVE_INFINITY, tab: null };
        for (var i = 0; i < tabs.length; i++) {
            var box = tabs[i].getBoundingClientRect();
            var offset = clientX - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                closest.offset = offset;
                closest.tab = tabs[i];
            }
        }

        if (closest.tab) {
            return { before: closest.tab, marker: closest.tab, side: "before" };
        }
        return { before: null, marker: tabs[tabs.length - 1], side: "after" };
    }

    function applyDomOrder(container, draggingTab, clientX) {
        var pos = getInsertPosition(container, draggingTab, clientX);
        clearDropMarkers(container);
        if (pos.marker && pos.side) {
            pos.marker.classList.add(
                pos.side === "before" ? "sheet-tab-drop-before" : "sheet-tab-drop-after"
            );
        }
        if (pos.before) {
            container.insertBefore(draggingTab, pos.before);
        } else {
            container.appendChild(draggingTab);
        }
    }

    function attach(opts) {
        if (!opts || !opts.container || typeof opts.onReorder !== "function") return;
        var container = opts.container;
        if (container._sheetTabsDragAttached) return;
        container._sheetTabsDragAttached = true;

        injectStyles();

        var drag = null;
        var suppressClickUntil = 0;

        function isDisabled() {
            return typeof opts.isDragDisabled === "function" && opts.isDragDisabled();
        }

        function finishDrag(commit) {
            if (!drag) return;
            var draggingTab = drag.tab;
            var fromIndex = drag.fromIndex;
            draggingTab.classList.remove("sheet-tab-dragging");
            clearDropMarkers(container);
            try {
                if (draggingTab.releasePointerCapture) {
                    draggingTab.releasePointerCapture(drag.pointerId);
                }
            } catch (e) {
                /* ignore */
            }

            if (commit && drag.dragging) {
                var toIndex = getTabIndex(container, draggingTab);
                if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
                    opts.onReorder(fromIndex, toIndex);
                }
                suppressClickUntil = Date.now() + 300;
            }

            drag = null;
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            document.removeEventListener("pointercancel", onPointerUp);
        }

        function onPointerMove(e) {
            if (!drag || e.pointerId !== drag.pointerId) return;
            var dx = Math.abs(e.clientX - drag.startX);
            var dy = Math.abs(e.clientY - drag.startY);
            if (!drag.dragging) {
                if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;
                drag.dragging = true;
                drag.tab.classList.add("sheet-tab-dragging");
                try {
                    drag.tab.setPointerCapture(e.pointerId);
                } catch (err) {
                    /* ignore */
                }
            }
            e.preventDefault();
            applyDomOrder(container, drag.tab, e.clientX);
        }

        function onPointerUp(e) {
            if (!drag || e.pointerId !== drag.pointerId) return;
            finishDrag(true);
        }

        container.addEventListener("pointerdown", function (e) {
            if (isDisabled() || e.button !== 0) return;
            if (e.target.closest(".sheet-close, .sheet-rename-input")) return;
            var tab = e.target.closest(TAB_SELECTOR);
            if (!tab || !container.contains(tab)) return;

            drag = {
                tab: tab,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                fromIndex: getTabIndex(container, tab),
                dragging: false,
            };

            document.addEventListener("pointermove", onPointerMove);
            document.addEventListener("pointerup", onPointerUp);
            document.addEventListener("pointercancel", onPointerUp);
        });

        container.addEventListener(
            "click",
            function (e) {
                if (Date.now() < suppressClickUntil) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            },
            true
        );
    }

    global.ToolSheetTabsDrag = { attach: attach };
})(typeof window !== "undefined" ? window : this);
