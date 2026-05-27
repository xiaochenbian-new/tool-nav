(function (global) {
    "use strict";

    var WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
    var WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var WEEKDAY_NAMES = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    var WEEKDAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    var MONTH_NAMES_EN = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    var MONTH_NAMES_EN_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    function pad(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function ymdKey(y, m, d) {
        return y + "-" + pad(m + 1) + "-" + pad(d);
    }

    function parseYmd(str) {
        if (!str || typeof str !== "string") return null;
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
        if (!m) return null;
        var y = +m[1];
        var mo = +m[2] - 1;
        var d = +m[3];
        var dt = new Date(y, mo, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
        return { year: y, month: mo, day: d };
    }

    function todayParts() {
        var now = new Date();
        return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
    }

    function getWeekNumber(date) {
        var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        var dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    function getDayContext(year, month, day) {
        var meta = global.ToolHolidays ? ToolHolidays.getDayMeta(year, month, day) : null;
        var lunar = global.ToolLunar ? ToolLunar.solarToLunar(year, month, day) : null;
        var holidayName = meta && meta.holiday ? meta.holiday.name : "";
        var subText = global.ToolLunar
            ? ToolLunar.getCellSubText(lunar, month, day, holidayName)
            : "";
        return { meta: meta, lunar: lunar, subText: subText };
    }

    function mount(root, options) {
        if (!root) return null;
        options = options || {};
        var compact = !!options.compact;

        var today = todayParts();

        function copyParts(p) {
            return { year: p.year, month: p.month, day: p.day };
        }

        var selected = parseYmd(options.selected) || copyParts(today);
        var viewYear = options.year != null ? options.year : (selected ? selected.year : today.year);
        var viewMonth = options.month != null ? options.month : (selected ? selected.month : today.month);

        root.innerHTML =
            '<div class="tool-cal' + (compact ? " tool-cal-compact" : "") + '">' +
            '  <div class="tool-cal-toolbar">' +
            '    <button type="button" class="tool-cal-nav" data-action="prev" title="上个月">‹</button>' +
            '    <div class="tool-cal-title-wrap">' +
            '      <select class="tool-cal-year-select" aria-label="选择年份"></select>' +
            '      <select class="tool-cal-month-select" aria-label="选择月份"></select>' +
            '      <button type="button" class="tool-cal-today-btn" data-action="today">今天</button>' +
            "    </div>" +
            '    <button type="button" class="tool-cal-nav" data-action="next" title="下个月">›</button>' +
            "  </div>" +
            '  <div class="tool-cal-weekdays"></div>' +
            '  <div class="tool-cal-grid"></div>' +
            '  <div class="tool-cal-info"></div>' +
            "</div>";

        var yearSelect = root.querySelector(".tool-cal-year-select");
        var monthSelect = root.querySelector(".tool-cal-month-select");
        var weekdaysEl = root.querySelector(".tool-cal-weekdays");
        var gridEl = root.querySelector(".tool-cal-grid");
        var infoEl = root.querySelector(".tool-cal-info");

        var YEAR_MIN = 1900;
        var YEAR_MAX = 2100;
        for (var y = YEAR_MIN; y <= YEAR_MAX; y++) {
            var yearOpt = document.createElement("option");
            yearOpt.value = String(y);
            yearOpt.textContent = y + "年";
            yearSelect.appendChild(yearOpt);
        }
        for (var m = 0; m < 12; m++) {
            var monthOpt = document.createElement("option");
            monthOpt.value = String(m);
            monthOpt.textContent = MONTH_LABELS[m] + " · " + MONTH_NAMES_EN[m];
            monthSelect.appendChild(monthOpt);
        }

        function syncPicker() {
            yearSelect.value = String(viewYear);
            monthSelect.value = String(viewMonth);
        }

        yearSelect.addEventListener("change", function () {
            viewYear = +yearSelect.value;
            paint();
        });
        monthSelect.addEventListener("change", function () {
            viewMonth = +monthSelect.value;
            paint();
        });

        WEEKDAYS.forEach(function (name, idx) {
            var cell = document.createElement("div");
            cell.className = "tool-cal-weekday" + (idx >= 5 ? " weekend" : "");
            cell.innerHTML =
                '<span class="tool-cal-weekday-zh">' + name + "</span>" +
                '<span class="tool-cal-weekday-en">' + WEEKDAYS_EN[idx] + "</span>";
            weekdaysEl.appendChild(cell);
        });

        function syncInfo() {
            if (!selected) {
                infoEl.innerHTML = "";
                return;
            }
            var dt = new Date(selected.year, selected.month, selected.day);
            var ymd = ymdKey(selected.year, selected.month, selected.day);
            var weekName = WEEKDAY_NAMES[dt.getDay()];
            var weekNameEn = WEEKDAY_NAMES_EN[dt.getDay()];
            var weekNo = getWeekNumber(dt);
            var monthEn = MONTH_NAMES_EN[selected.month];
            var monthEnShort = MONTH_NAMES_EN_SHORT[selected.month];
            var ctx = getDayContext(selected.year, selected.month, selected.day);
            var rows =
                '<div class="tool-cal-info-row"><span class="tool-cal-info-label">公历</span><strong>' +
                ymd +
                "</strong><span class=\"tool-cal-info-en\">" +
                monthEnShort +
                " " +
                selected.day +
                ", " +
                selected.year +
                "</span></div>" +
                '<div class="tool-cal-info-row"><span class="tool-cal-info-label">星期</span><span>' +
                weekName +
                ' <span class="tool-cal-info-en">/ ' +
                weekNameEn +
                "</span>（第 " +
                weekNo +
                ' 周 <span class="tool-cal-info-en">/ Week ' +
                weekNo +
                "</span>）</span></div>" +
                '<div class="tool-cal-info-row"><span class="tool-cal-info-label">月份</span><span>' +
                MONTH_LABELS[selected.month] +
                ' <span class="tool-cal-info-en">/ ' +
                monthEn +
                "</span></span></div>";
            if (ctx.lunar) {
                rows += '<div class="tool-cal-info-row"><span class="tool-cal-info-label">农历</span><span>' + ctx.lunar.text + "</span></div>";
            }
            if (ctx.meta && ctx.meta.isHoliday) {
                rows += '<div class="tool-cal-info-row"><span class="tool-cal-info-label">节假日</span><span class="tool-cal-info-holiday">' + ctx.meta.holiday.name + "（休）</span></div>";
            } else if (ctx.meta && ctx.meta.isWorkdayOverride) {
                rows += '<div class="tool-cal-info-row"><span class="tool-cal-info-label">调休</span><span class="tool-cal-info-workday">周末上班</span></div>';
            } else if (ctx.meta && ctx.meta.isRestDay) {
                rows += '<div class="tool-cal-info-row"><span class="tool-cal-info-label">周末</span><span class="tool-cal-info-rest">休息</span></div>';
            }
            infoEl.innerHTML = rows;
        }

        function paint() {
            syncPicker();
            gridEl.innerHTML = "";

            var first = new Date(viewYear, viewMonth, 1);
            var startOffset = (first.getDay() + 6) % 7;
            var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
            var prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
            var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

            for (var i = 0; i < totalCells; i++) {
                var cell = document.createElement("button");
                cell.type = "button";
                cell.className = "tool-cal-day tool-cal-day-stack";

                var dayNum;
                var cellYear = viewYear;
                var cellMonth = viewMonth;
                var muted = false;
                var col = i % 7;

                if (i < startOffset) {
                    dayNum = prevMonthDays - startOffset + i + 1;
                    cellMonth = viewMonth - 1;
                    if (cellMonth < 0) {
                        cellMonth = 11;
                        cellYear = viewYear - 1;
                    }
                    muted = true;
                } else if (i >= startOffset + daysInMonth) {
                    dayNum = i - startOffset - daysInMonth + 1;
                    cellMonth = viewMonth + 1;
                    if (cellMonth > 11) {
                        cellMonth = 0;
                        cellYear = viewYear + 1;
                    }
                    muted = true;
                } else {
                    dayNum = i - startOffset + 1;
                }

                var ctx = getDayContext(cellYear, cellMonth, dayNum);
                if (muted) cell.classList.add("muted");
                if (col >= 5) cell.classList.add("weekend-col");
                if (ctx.meta && ctx.meta.isRestDay) cell.classList.add("rest");
                if (ctx.meta && ctx.meta.isHoliday) cell.classList.add("holiday");
                if (ctx.meta && ctx.meta.isWorkdayOverride) cell.classList.add("workday");

                if (cellYear === today.year && cellMonth === today.month && dayNum === today.day) {
                    cell.classList.add("today");
                }
                if (selected && cellYear === selected.year && cellMonth === selected.month && dayNum === selected.day) {
                    cell.classList.add("selected");
                }

                var numEl = document.createElement("span");
                numEl.className = "tool-cal-day-num";
                numEl.textContent = String(dayNum);
                cell.appendChild(numEl);

                if (ctx.subText) {
                    var subEl = document.createElement("span");
                    subEl.className = "tool-cal-day-sub";
                    if (ctx.meta && ctx.meta.isWorkdayOverride) {
                        subEl.classList.add("workday-tag");
                    } else if (ctx.meta && ctx.meta.isHoliday) {
                        subEl.classList.add("holiday-tag");
                    }
                    subEl.textContent = ctx.subText;
                    cell.appendChild(subEl);
                }

                (function (y, m, d) {
                    cell.addEventListener("click", function (e) {
                        e.stopPropagation();
                        selected = { year: y, month: m, day: d };
                        if (m !== viewMonth || y !== viewYear) {
                            viewYear = y;
                            viewMonth = m;
                        }
                        paint();
                        syncInfo();
                        if (typeof options.onSelect === "function") {
                            options.onSelect(ymdKey(y, m, d), selected);
                        }
                    });
                })(cellYear, cellMonth, dayNum);

                gridEl.appendChild(cell);
            }
            syncInfo();
        }

        function shiftMonth(delta) {
            viewMonth += delta;
            if (viewMonth < 0) {
                viewMonth = 11;
                viewYear -= 1;
            } else if (viewMonth > 11) {
                viewMonth = 0;
                viewYear += 1;
            }
            if (viewYear < YEAR_MIN) {
                viewYear = YEAR_MIN;
                viewMonth = 0;
            } else if (viewYear > YEAR_MAX) {
                viewYear = YEAR_MAX;
                viewMonth = 11;
            }
            paint();
        }

        function onWheel(e) {
            if (!e.deltaY) return;
            e.preventDefault();
            e.stopPropagation();
            shiftMonth(e.deltaY > 0 ? 1 : -1);
        }

        root.addEventListener("wheel", onWheel, { passive: false });
        if (root.parentElement) {
            root.parentElement.addEventListener("wheel", onWheel, { passive: false });
        }

        root.addEventListener("click", function (e) {
            e.stopPropagation();
        });
        root.addEventListener("pointerdown", function (e) {
            e.stopPropagation();
        });

        root.addEventListener("click", function (e) {
            var btn = e.target.closest("[data-action]");
            if (!btn || !root.contains(btn)) return;
            var action = btn.getAttribute("data-action");
            if (action === "prev") {
                shiftMonth(-1);
            } else if (action === "next") {
                shiftMonth(1);
            } else if (action === "today") {
                viewYear = today.year;
                viewMonth = today.month;
                selected = copyParts(today);
                paint();
                if (typeof options.onSelect === "function") {
                    options.onSelect(ymdKey(today.year, today.month, today.day), selected);
                }
            }
        });

        paint();

        return {
            goToday: function () {
                var now = todayParts();
                viewYear = now.year;
                viewMonth = now.month;
                selected = copyParts(now);
                paint();
            },
            shiftMonth: shiftMonth,
            getSelected: function () {
                return selected ? ymdKey(selected.year, selected.month, selected.day) : "";
            },
            refresh: paint
        };
    }

    global.ToolCalendar = {
        mount: mount,
        ymdKey: ymdKey,
        parseYmd: parseYmd
    };
})(typeof window !== "undefined" ? window : this);
