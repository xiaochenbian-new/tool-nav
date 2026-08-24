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
    var YEAR_WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
    var YEAR_MONTH_COLOR_COUNT = 6;

    function getCalendarZodiac(year) {
        if (global.ToolLunar && ToolLunar.solarToLunar) {
            for (var m = 0; m <= 2; m++) {
                var daysInMonth = new Date(year, m + 1, 0).getDate();
                for (var d = 1; d <= daysInMonth; d++) {
                    var lunar = ToolLunar.solarToLunar(year, m, d);
                    if (lunar && lunar.lunarMonth === 1 && lunar.lunarDay === 1 && !lunar.isLeap) {
                        return lunar.zodiac;
                    }
                }
            }
            var midYear = ToolLunar.solarToLunar(year, 6, 15);
            if (midYear && midYear.zodiac) {
                return midYear.zodiac;
            }
        }
        if (global.ToolLunar && ToolLunar.getZodiac) {
            return ToolLunar.getZodiac(year);
        }
        return "";
    }

    function getYearZodiac(year) {
        return getCalendarZodiac(year);
    }

    function formatYearTitle(year) {
        var zodiac = getCalendarZodiac(year);
        return zodiac ? year + "年" + zodiac + "年日历" : year + "年日历";
    }

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
        var holidayName = meta && meta.holiday && meta.holiday.type === "holiday" ? meta.holiday.name : "";
        var subText = global.ToolLunar
            ? ToolLunar.getCellSubText(lunar, month, day, holidayName)
            : holidayName;
        return { meta: meta, lunar: lunar, subText: subText };
    }

    function mount(root, options) {
        if (!root) return null;
        options = options || {};
        var compact = !!options.compact;
        var fullscreen = !!options.fullscreen;
        var showPrintButton = options.showPrintButton === true;
        var externalTick = !!options.externalTick;

        var today = todayParts();

        function copyParts(p) {
            return { year: p.year, month: p.month, day: p.day };
        }

        var selected = parseYmd(options.selected) || copyParts(today);
        var viewYear = options.year != null ? options.year : (selected ? selected.year : today.year);
        var viewMonth = options.month != null ? options.month : (selected ? selected.month : today.month);
        var viewMode = "month";

        root.innerHTML =
            '<div class="tool-cal' +
            (compact ? " tool-cal-compact" : "") +
            (fullscreen ? " tool-cal-fullscreen" : "") +
            '">' +
            '  <div class="tool-cal-head">' +
            '    <select class="tool-cal-holiday-select" aria-label="选择假期">' +
            '      <option value="">假期</option>' +
            "    </select>" +
            '    <select class="tool-cal-year-select" aria-label="选择年份"></select>' +
            '    <span class="tool-cal-month-nav">' +
            '      <button type="button" class="tool-cal-nav" data-action="prev" title="上个月">‹</button>' +
            '      <select class="tool-cal-month-select" aria-label="选择月份"></select>' +
            '      <button type="button" class="tool-cal-nav" data-action="next" title="下个月">›</button>' +
            "    </span>" +
            '    <button type="button" class="tool-cal-today-btn" data-action="today">今天</button>' +
            '    <button type="button" class="tool-cal-year-toggle" data-action="year-view" title="查看全年">年历</button>' +
            '    <button type="button" class="tool-cal-print-btn" data-action="print-year" title="打印年历">打印</button>' +
            "  </div>" +
            '  <div class="tool-cal-month-view">' +
            '    <div class="tool-cal-weekdays"></div>' +
            '    <div class="tool-cal-grid"></div>' +
            '    <div class="tool-cal-info"></div>' +
            '    <div class="tool-cal-footer"></div>' +
            "  </div>" +
            '  <div class="tool-cal-year-view" hidden>' +
            '    <div class="tool-cal-year-print-head">' +
            '      <div class="tool-cal-year-print-zodiac">' +
            '        <img class="tool-cal-year-print-zodiac-img" alt="" />' +
            "      </div>" +
            '      <span class="tool-cal-year-print-title"></span>' +
            "    </div>" +
            '    <div class="tool-cal-year-grid"></div>' +
            "  </div>" +
            "</div>";

        var calEl = root.querySelector(".tool-cal");
        var holidaySelect = root.querySelector(".tool-cal-holiday-select");
        var yearSelect = root.querySelector(".tool-cal-year-select");
        var monthSelect = root.querySelector(".tool-cal-month-select");
        var monthNavEl = root.querySelector(".tool-cal-month-nav");
        var weekdaysEl = root.querySelector(".tool-cal-weekdays");
        var gridEl = root.querySelector(".tool-cal-grid");
        var infoEl = root.querySelector(".tool-cal-info");
        var footerEl = root.querySelector(".tool-cal-footer");
        var monthViewEl = root.querySelector(".tool-cal-month-view");
        var yearViewEl = root.querySelector(".tool-cal-year-view");
        var yearGridEl = root.querySelector(".tool-cal-year-grid");
        var yearPrintZodiacEl = root.querySelector(".tool-cal-year-print-zodiac");
        var yearPrintZodiacImgEl = root.querySelector(".tool-cal-year-print-zodiac-img");
        var yearPrintTitleEl = root.querySelector(".tool-cal-year-print-title");
        var yearToggleBtn = root.querySelector(".tool-cal-year-toggle");
        var printBtn = root.querySelector(".tool-cal-print-btn");

        if (compact && yearToggleBtn) {
            yearToggleBtn.hidden = true;
        }

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
            monthOpt.textContent = MONTH_LABELS[m] + "·" + MONTH_NAMES_EN_SHORT[m];
            monthSelect.appendChild(monthOpt);
        }

        WEEKDAYS.forEach(function (name, idx) {
            var cell = document.createElement("div");
            cell.className = "tool-cal-weekday" + (idx >= 5 ? " weekend" : "");
            cell.innerHTML =
                '<span class="tool-cal-weekday-zh">' + name + "</span>" +
                '<span class="tool-cal-weekday-en">' + WEEKDAYS_EN[idx] + "</span>";
            weekdaysEl.appendChild(cell);
        });

        function syncPicker() {
            yearSelect.value = String(viewYear);
            monthSelect.value = String(viewMonth);
        }

        function fillHolidaySelect() {
            holidaySelect.innerHTML = '<option value="">假期</option>';
            if (!global.ToolHolidays || !ToolHolidays.getHolidaysForYear) return;
            var list = ToolHolidays.getHolidaysForYear(viewYear);
            list.forEach(function (item) {
                var opt = document.createElement("option");
                opt.value = item.start;
                var rangeText = item.start === item.end ? item.start.slice(5) : item.start.slice(5) + "~" + item.end.slice(5);
                opt.textContent = item.name + "（" + rangeText + "）";
                opt.dataset.name = item.name;
                holidaySelect.appendChild(opt);
            });
        }

        function syncFooter() {
            if (!footerEl) return;
            if (!global.ToolHolidays || !ToolHolidays.getNextHolidayCountdown) {
                footerEl.innerHTML = "";
                return;
            }
            var info = ToolHolidays.getNextHolidayCountdown(new Date());
            if (!info) {
                footerEl.innerHTML = "";
                return;
            }
            if (info.inProgress) {
                footerEl.innerHTML =
                    '<span class="tool-cal-footer-icon" aria-hidden="true">⏱</span>' +
                    '<span class="tool-cal-footer-text">正在 <strong>' +
                    info.label +
                    "</strong> 假期中</span>";
            } else {
                footerEl.innerHTML =
                    '<span class="tool-cal-footer-icon" aria-hidden="true">⏱</span>' +
                    '<span class="tool-cal-footer-text">距离 <strong>' +
                    info.label +
                    "</strong> 还有 <em>" +
                    info.daysLeft +
                    "</em> 天</span>";
            }
        }

        function goToDate(parts, opts) {
            if (!parts) return;
            opts = opts || {};
            viewYear = parts.year;
            viewMonth = parts.month;
            if (opts.select !== false) {
                selected = copyParts(parts);
            }
            syncPicker();
            fillHolidaySelect();
            if (isYearView() && opts.select !== false && opts.keepYearView !== true) {
                setViewMode("month");
                return;
            }
            repaint();
            if (!opts.skipFooter) syncFooter();
            if (opts.select !== false && typeof options.onSelect === "function") {
                options.onSelect(ymdKey(parts.year, parts.month, parts.day), selected);
            }
        }

        function goToYmd(ymd, opts) {
            goToDate(parseYmd(ymd), opts);
        }

        holidaySelect.addEventListener("change", function () {
            var ymd = holidaySelect.value;
            if (!ymd) return;
            goToYmd(ymd);
            holidaySelect.value = "";
        });

        yearSelect.addEventListener("change", function () {
            viewYear = +yearSelect.value;
            fillHolidaySelect();
            if (viewMode === "year") {
                paintYear();
            } else {
                paint();
            }
        });

        monthSelect.addEventListener("change", function () {
            viewMonth = +monthSelect.value;
            if (isYearView()) {
                paintYear();
            } else {
                paint();
            }
        });

        var tickTimer = null;
        var lastTickDateKey = ymdKey(today.year, today.month, today.day);

        function isSelectedToday() {
            if (!selected) return false;
            var now = todayParts();
            return (
                selected.year === now.year &&
                selected.month === now.month &&
                selected.day === now.day
            );
        }

        function formatInfoPrimaryLine() {
            var dt = new Date(selected.year, selected.month, selected.day);
            var weekName = WEEKDAY_NAMES[dt.getDay()];
            var line =
                selected.year +
                "年" +
                (selected.month + 1) +
                "月" +
                selected.day +
                "日";
            if (isSelectedToday()) {
                var now = new Date();
                line +=
                    " " +
                    pad(now.getHours()) +
                    ":" +
                    pad(now.getMinutes()) +
                    ":" +
                    pad(now.getSeconds());
            }
            return line + " " + weekName;
        }

        function syncInfo() {
            if (!selected) {
                infoEl.innerHTML = "";
                return;
            }
            var ctx = getDayContext(selected.year, selected.month, selected.day);
            var lunarLine = "";
            if (ctx.lunar && ctx.lunar.text) {
                lunarLine = "农历";
                if (ctx.lunar.zodiac) {
                    lunarLine += '<span class="tool-cal-info-zodiac">' + ctx.lunar.zodiac + "年</span>";
                }
                lunarLine += ctx.lunar.text;
            }
            infoEl.innerHTML =
                '<div class="tool-cal-info-primary">' +
                formatInfoPrimaryLine() +
                "</div>" +
                (lunarLine ? '<div class="tool-cal-info-lunar">' + lunarLine + "</div>" : "");
        }

        function shouldRunLiveTick() {
            return typeof options.shouldTick !== "function" || options.shouldTick();
        }

        function handleDayRollover() {
            var nowToday = todayParts();
            var nowKey = ymdKey(nowToday.year, nowToday.month, nowToday.day);
            if (nowKey === lastTickDateKey) return false;

            var prevKey = lastTickDateKey;
            lastTickDateKey = nowKey;

            var wasShowingToday =
                selected &&
                ymdKey(selected.year, selected.month, selected.day) === prevKey;

            if (wasShowingToday) {
                goToDate(copyParts(nowToday));
            } else {
                today = nowToday;
                repaint();
            }
            return true;
        }

        function tickInfoNow() {
            if (handleDayRollover()) {
                return;
            }
            if (!shouldRunLiveTick()) {
                return;
            }
            if (!isSelectedToday()) {
                return;
            }
            syncInfo();
        }

        function wake() {
            if (handleDayRollover()) {
                if (shouldRunLiveTick()) {
                    startInfoTick();
                }
                return;
            }
            if (shouldRunLiveTick()) {
                if (isSelectedToday()) {
                    syncInfo();
                }
                startInfoTick();
            }
        }

        function onResume() {
            wake();
        }

        var onVisChange = function () {
            if (document.visibilityState === "visible") {
                onResume();
            }
        };
        var onPageShow = function (e) {
            if (e.persisted) {
                onResume();
            }
        };

        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", onVisChange);
        }
        if (typeof window !== "undefined") {
            window.addEventListener("pageshow", onPageShow);
            window.addEventListener("focus", onResume);
        }

        function startInfoTick() {
            stopInfoTick();
            tickInfoNow();
            tickTimer = setInterval(tickInfoNow, 1000);
        }

        function stopInfoTick() {
            if (tickTimer) {
                clearInterval(tickTimer);
                tickTimer = null;
            }
        }

        function setLiveTimeEnabled(enabled) {
            if (enabled) {
                startInfoTick();
            } else {
                stopInfoTick();
                syncInfo();
            }
        }

        function resumeLiveTime() {
            startInfoTick();
        }

        function pauseLiveTime() {
            stopInfoTick();
        }

        function isYearView() {
            return viewMode === "year";
        }

        function notifyViewModeChange() {
            if (typeof options.onViewModeChange === "function") {
                options.onViewModeChange(viewMode);
            }
        }

        function applyViewModeUi() {
            if (calEl) {
                calEl.classList.toggle("tool-cal-year-mode", isYearView());
            }
            if (monthViewEl) {
                monthViewEl.hidden = isYearView();
            }
            if (yearViewEl) {
                yearViewEl.hidden = !isYearView();
            }
            if (monthNavEl) {
                monthNavEl.hidden = isYearView();
            }
            if (printBtn) {
                printBtn.hidden = !isYearView() || compact || !showPrintButton;
            }
            if (yearToggleBtn) {
                yearToggleBtn.textContent = isYearView() ? "月历" : "年历";
                yearToggleBtn.title = isYearView() ? "返回月历" : "查看全年";
            }
        }

        function setViewMode(mode) {
            var next = mode === "year" ? "year" : "month";
            if (viewMode === next) {
                applyViewModeUi();
                notifyViewModeChange();
                return;
            }
            viewMode = next;
            applyViewModeUi();
            if (isYearView()) {
                paintYear();
                stopInfoTick();
            } else {
                paint();
                startInfoTick();
            }
            notifyViewModeChange();
        }

        function toggleViewMode() {
            setViewMode(isYearView() ? "month" : "year");
        }

        function syncYearPrintHead() {
            var zodiac = getCalendarZodiac(viewYear);
            if (yearPrintZodiacEl) {
                yearPrintZodiacEl.hidden = !zodiac;
            }
            if (yearPrintZodiacImgEl) {
                if (zodiac && global.ToolZodiacIcons && ToolZodiacIcons.getZodiacIconDataUri) {
                    yearPrintZodiacImgEl.src = ToolZodiacIcons.getZodiacIconDataUri(zodiac);
                    yearPrintZodiacImgEl.alt = viewYear + "年" + zodiac + "生肖";
                } else {
                    yearPrintZodiacImgEl.removeAttribute("src");
                    yearPrintZodiacImgEl.alt = "";
                }
            }
            if (yearPrintTitleEl) {
                yearPrintTitleEl.textContent = formatYearTitle(viewYear);
            }
        }

        function printYearView() {
            if (!isYearView()) {
                setViewMode("year");
            }
            syncYearPrintHead();
            document.body.classList.add("tool-cal-printing-year");
            var onAfterPrint = function () {
                document.body.classList.remove("tool-cal-printing-year");
                window.removeEventListener("afterprint", onAfterPrint);
            };
            window.addEventListener("afterprint", onAfterPrint);
            window.print();
        }

        function createYearDayCell(cellYear, cellMonth, dayNum, opts) {
            opts = opts || {};
            var muted = !!opts.muted;
            var dow = opts.dow != null ? opts.dow : new Date(cellYear, cellMonth, dayNum).getDay();
            var ctx = getDayContext(cellYear, cellMonth, dayNum);
            var isToday =
                cellYear === today.year && cellMonth === today.month && dayNum === today.day;
            var isHoliday = !!(ctx.meta && ctx.meta.isHoliday);
            var isWorkday = !!(ctx.meta && ctx.meta.isWorkdayOverride);

            var cell = document.createElement("button");
            cell.type = "button";
            cell.className = "tool-cal-year-cell";

            if (muted) cell.classList.add("muted");
            if (dow === 0) cell.classList.add("sun-col");
            if (dow === 6) cell.classList.add("sat-col");
            if (isHoliday) cell.classList.add("holiday");
            if (isWorkday) cell.classList.add("workday");
            if (isToday) cell.classList.add("today");

            if (isToday) {
                var todayBadge = document.createElement("span");
                todayBadge.className = "tool-cal-year-cell-badge";
                todayBadge.textContent = "今";
                todayBadge.title = "今天";
                cell.appendChild(todayBadge);
            }

            var numEl = document.createElement("span");
            numEl.className = "tool-cal-year-cell-num";
            numEl.textContent = String(dayNum);
            cell.appendChild(numEl);

            if (ctx.subText) {
                var subEl = document.createElement("span");
                subEl.className = "tool-cal-year-cell-sub";
                if (isWorkday) {
                    subEl.classList.add("workday-tag");
                } else if (isHoliday) {
                    subEl.classList.add("holiday-tag");
                }
                subEl.textContent = ctx.subText;
                subEl.title = ctx.subText;
                cell.appendChild(subEl);
            }

            (function (y, m, d) {
                cell.addEventListener("click", function (e) {
                    e.stopPropagation();
                    selected = { year: y, month: m, day: d };
                    viewYear = y;
                    viewMonth = m;
                    syncPicker();
                    fillHolidaySelect();
                    setViewMode("month");
                    syncFooter();
                    if (typeof options.onSelect === "function") {
                        options.onSelect(ymdKey(y, m, d), selected);
                    }
                });
            })(cellYear, cellMonth, dayNum);

            return cell;
        }

        function renderYearMonthTable(year, month, container) {
            container.innerHTML = "";

            var table = document.createElement("table");
            table.className = "tool-cal-year-table";

            var thead = document.createElement("thead");
            var headRow = document.createElement("tr");
            var wkHead = document.createElement("th");
            wkHead.className = "tool-cal-year-wk";
            wkHead.textContent = "周";
            headRow.appendChild(wkHead);
            YEAR_WEEKDAYS.forEach(function (name, idx) {
                var th = document.createElement("th");
                th.className = "tool-cal-year-wd" + (idx === 0 || idx === 6 ? " weekend" : "");
                th.textContent = name;
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            table.appendChild(thead);

            var tbody = document.createElement("tbody");
            var first = new Date(year, month, 1);
            var startOffset = first.getDay();
            var daysInMonth = new Date(year, month + 1, 0).getDate();
            var prevMonthDays = new Date(year, month, 0).getDate();
            var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
            var rowCount = totalCells / 7;
            var YEAR_TABLE_ROWS = 6;

            for (var row = 0; row < YEAR_TABLE_ROWS; row++) {
                var tr = document.createElement("tr");
                var wkTd = document.createElement("td");
                wkTd.className = "tool-cal-year-wk-num";

                if (row < rowCount) {
                    var rowStartIdx = row * 7;
                    var weekRefYear = year;
                    var weekRefMonth = month;
                    var weekRefDay = rowStartIdx - startOffset + 1;
                    if (weekRefDay < 1) {
                        weekRefMonth = month - 1;
                        if (weekRefMonth < 0) {
                            weekRefMonth = 11;
                            weekRefYear = year - 1;
                        }
                        weekRefDay = new Date(weekRefYear, weekRefMonth + 1, 0).getDate() + weekRefDay;
                    }
                    wkTd.textContent = String(getWeekNumber(new Date(weekRefYear, weekRefMonth, weekRefDay)));
                }
                tr.appendChild(wkTd);

                for (var col = 0; col < 7; col++) {
                    var td = document.createElement("td");
                    td.className = "tool-cal-year-day";

                    if (row >= rowCount) {
                        td.classList.add("tool-cal-year-day-empty");
                        tr.appendChild(td);
                        continue;
                    }

                    var i = row * 7 + col;
                    var dayNum;
                    var cellYear = year;
                    var cellMonth = month;
                    var muted = false;

                    if (i < startOffset) {
                        dayNum = prevMonthDays - startOffset + i + 1;
                        cellMonth = month - 1;
                        if (cellMonth < 0) {
                            cellMonth = 11;
                            cellYear = year - 1;
                        }
                        muted = true;
                    } else if (i >= startOffset + daysInMonth) {
                        dayNum = i - startOffset - daysInMonth + 1;
                        cellMonth = month + 1;
                        if (cellMonth > 11) {
                            cellMonth = 0;
                            cellYear = year + 1;
                        }
                        muted = true;
                    } else {
                        dayNum = i - startOffset + 1;
                    }

                    td.appendChild(createYearDayCell(cellYear, cellMonth, dayNum, { muted: muted, dow: col }));
                    tr.appendChild(td);
                }

                tbody.appendChild(tr);
            }

            table.appendChild(tbody);
            container.appendChild(table);
        }

        function createDayCell(cellYear, cellMonth, dayNum, opts) {
            opts = opts || {};
            var mini = !!opts.mini;
            var col = opts.col != null ? opts.col : ((new Date(cellYear, cellMonth, dayNum).getDay() + 6) % 7);
            var muted = !!opts.muted;
            var ctx = getDayContext(cellYear, cellMonth, dayNum);
            var isToday =
                cellYear === today.year && cellMonth === today.month && dayNum === today.day;
            var isSelected =
                !mini &&
                selected &&
                cellYear === selected.year &&
                cellMonth === selected.month &&
                dayNum === selected.day;

            var cell = document.createElement("button");
            cell.type = "button";
            cell.className = "tool-cal-day tool-cal-day-stack" + (mini ? " tool-cal-day-mini" : "");

            if (muted) cell.classList.add("muted");
            if (col >= 5) cell.classList.add("weekend-col");
            if (ctx.meta && ctx.meta.isRestDay) cell.classList.add("rest");
            if (ctx.meta && ctx.meta.isHoliday) cell.classList.add("holiday");
            if (ctx.meta && ctx.meta.isWorkdayOverride) cell.classList.add("workday");
            if (isToday) cell.classList.add("today");
            if (isSelected) cell.classList.add("selected");

            if (isToday) {
                var todayBadge = document.createElement("span");
                todayBadge.className = "tool-cal-day-badge badge-today";
                todayBadge.textContent = mini ? "今" : "今";
                cell.appendChild(todayBadge);
            } else if (ctx.meta && ctx.meta.isHoliday) {
                var holidayBadge = document.createElement("span");
                holidayBadge.className = "tool-cal-day-badge badge-holiday";
                holidayBadge.textContent = "休";
                holidayBadge.title = ctx.meta.holiday.name + "（放假）";
                cell.appendChild(holidayBadge);
            } else if (ctx.meta && ctx.meta.isWorkdayOverride) {
                var workBadge = document.createElement("span");
                workBadge.className = "tool-cal-day-badge badge-workday";
                workBadge.textContent = "班";
                workBadge.title = "调休上班";
                cell.appendChild(workBadge);
            }

            var numEl = document.createElement("span");
            numEl.className = "tool-cal-day-num";
            numEl.textContent = String(dayNum);
            cell.appendChild(numEl);

            if (!mini && ctx.subText) {
                var subEl = document.createElement("span");
                subEl.className = "tool-cal-day-sub";
                if (ctx.meta && ctx.meta.isWorkdayOverride) {
                    subEl.classList.add("workday-tag");
                } else if (ctx.meta && ctx.meta.isHoliday) {
                    subEl.classList.add("holiday-tag");
                }
                subEl.textContent = ctx.subText;
                subEl.title = ctx.subText;
                cell.appendChild(subEl);
            }

            (function (y, m, d) {
                cell.addEventListener("click", function (e) {
                    e.stopPropagation();
                    if (mini) {
                        selected = { year: y, month: m, day: d };
                        viewYear = y;
                        viewMonth = m;
                        syncPicker();
                        fillHolidaySelect();
                        setViewMode("month");
                        syncFooter();
                        if (typeof options.onSelect === "function") {
                            options.onSelect(ymdKey(y, m, d), selected);
                        }
                        return;
                    }
                    selected = { year: y, month: m, day: d };
                    if (m !== viewMonth || y !== viewYear) {
                        viewYear = y;
                        viewMonth = m;
                    }
                    paint();
                    syncFooter();
                    if (typeof options.onSelect === "function") {
                        options.onSelect(ymdKey(y, m, d), selected);
                    }
                });
            })(cellYear, cellMonth, dayNum);

            return cell;
        }

        function renderMonthGrid(year, month, gridContainer, opts) {
            opts = opts || {};
            var mini = !!opts.mini;
            gridContainer.innerHTML = "";

            var first = new Date(year, month, 1);
            var startOffset = (first.getDay() + 6) % 7;
            var daysInMonth = new Date(year, month + 1, 0).getDate();
            var prevMonthDays = new Date(year, month, 0).getDate();
            var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

            for (var i = 0; i < totalCells; i++) {
                var dayNum;
                var cellYear = year;
                var cellMonth = month;
                var muted = false;
                var col = i % 7;

                if (i < startOffset) {
                    dayNum = prevMonthDays - startOffset + i + 1;
                    cellMonth = month - 1;
                    if (cellMonth < 0) {
                        cellMonth = 11;
                        cellYear = year - 1;
                    }
                    muted = true;
                } else if (i >= startOffset + daysInMonth) {
                    dayNum = i - startOffset - daysInMonth + 1;
                    cellMonth = month + 1;
                    if (cellMonth > 11) {
                        cellMonth = 0;
                        cellYear = year + 1;
                    }
                    muted = true;
                } else {
                    dayNum = i - startOffset + 1;
                }

                gridContainer.appendChild(
                    createDayCell(cellYear, cellMonth, dayNum, { mini: mini, muted: muted, col: col })
                );
            }
        }

        function paintYear() {
            today = todayParts();
            lastTickDateKey = ymdKey(today.year, today.month, today.day);
            syncPicker();
            syncYearPrintHead();
            if (!yearGridEl) return;
            yearGridEl.innerHTML = "";

            for (var m = 0; m < 12; m++) {
                var block = document.createElement("div");
                block.className =
                    "tool-cal-year-month tool-cal-year-month--c" + (m % YEAR_MONTH_COLOR_COUNT);
                block.dataset.month = String(m);

                var title = document.createElement("div");
                title.className = "tool-cal-year-month-title";
                title.textContent = MONTH_LABELS[m] + " " + MONTH_NAMES_EN_SHORT[m];
                block.appendChild(title);

                var tableWrap = document.createElement("div");
                tableWrap.className = "tool-cal-year-table-wrap";
                renderYearMonthTable(viewYear, m, tableWrap);
                block.appendChild(tableWrap);

                (function (monthIdx) {
                    title.addEventListener("click", function (e) {
                        e.stopPropagation();
                        viewMonth = monthIdx;
                        syncPicker();
                        setViewMode("month");
                    });
                })(m);

                yearGridEl.appendChild(block);
            }
        }

        function repaint() {
            if (isYearView()) {
                paintYear();
            } else {
                paint();
            }
        }

        function paint() {
            today = todayParts();
            lastTickDateKey = ymdKey(today.year, today.month, today.day);
            syncPicker();
            renderMonthGrid(viewYear, viewMonth, gridEl, { mini: false });
            syncInfo();
            syncFooter();
        }

        function shiftMonth(delta) {
            if (isYearView()) return;
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
            fillHolidaySelect();
            paint();
        }

        function onWheel(e) {
            if (isYearView() || !e.deltaY) return;
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
                goToDate(copyParts(todayParts()));
            } else if (action === "year-view") {
                toggleViewMode();
            } else if (action === "print-year") {
                printYearView();
            }
        });

        applyViewModeUi();
        fillHolidaySelect();
        paint();
        startInfoTick();

        return {
            goToday: function (withTick) {
                goToDate(copyParts(todayParts()));
                if (withTick !== false && !isYearView()) {
                    startInfoTick();
                } else {
                    syncInfo();
                }
            },
            wake: wake,
            tickInfoNow: tickInfoNow,
            syncInfo: syncInfo,
            isLiveTimeActive: function () {
                return tickTimer != null;
            },
            goToDate: goToDate,
            goToYmd: goToYmd,
            shiftMonth: shiftMonth,
            getSelected: function () {
                return selected ? ymdKey(selected.year, selected.month, selected.day) : "";
            },
            refresh: function () {
                fillHolidaySelect();
                repaint();
            },
            startInfoTick: startInfoTick,
            stopInfoTick: stopInfoTick,
            setLiveTimeEnabled: setLiveTimeEnabled,
            resumeLiveTime: resumeLiveTime,
            pauseLiveTime: pauseLiveTime,
            setViewMode: setViewMode,
            toggleViewMode: toggleViewMode,
            getViewMode: function () {
                return viewMode;
            },
            isYearView: isYearView,
            printYearView: printYearView,
            applyState: function (state) {
                if (!state) return;
                if (state.viewMode === "year" || state.viewMode === "month") {
                    setViewMode(state.viewMode);
                }
                if (state.selected) {
                    goToYmd(state.selected);
                } else if (state.viewYear != null && state.viewMonth != null) {
                    viewYear = state.viewYear;
                    viewMonth = state.viewMonth;
                    syncPicker();
                    fillHolidaySelect();
                    repaint();
                }
            },
            getState: function () {
                return {
                    selected: selected ? ymdKey(selected.year, selected.month, selected.day) : "",
                    viewYear: viewYear,
                    viewMonth: viewMonth,
                    viewMode: viewMode
                };
            },
            destroy: function () {
                stopInfoTick();
                if (typeof document !== "undefined") {
                    document.removeEventListener("visibilitychange", onVisChange);
                }
                if (typeof window !== "undefined") {
                    window.removeEventListener("pageshow", onPageShow);
                    window.removeEventListener("focus", onResume);
                }
            }
        };
    }

    global.ToolCalendar = {
        mount: mount,
        ymdKey: ymdKey,
        parseYmd: parseYmd
    };
})(typeof window !== "undefined" ? window : this);
