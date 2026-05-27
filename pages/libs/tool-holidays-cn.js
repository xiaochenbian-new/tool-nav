(function (global) {
    "use strict";

    /** 国务院公布的放假 / 调休安排（2024–2026） */
    var YEAR_PLANS = {
        2024: {
            holidays: [
                { start: "2024-01-01", end: "2024-01-01", name: "元旦" },
                { start: "2024-02-10", end: "2024-02-17", name: "春节" },
                { start: "2024-04-04", end: "2024-04-06", name: "清明" },
                { start: "2024-05-01", end: "2024-05-05", name: "劳动节" },
                { start: "2024-06-08", end: "2024-06-10", name: "端午" },
                { start: "2024-09-15", end: "2024-09-17", name: "中秋" },
                { start: "2024-10-01", end: "2024-10-07", name: "国庆" }
            ],
            workdays: ["2024-02-04", "2024-02-18", "2024-04-07", "2024-04-28", "2024-05-11", "2024-09-14", "2024-09-29", "2024-10-12"]
        },
        2025: {
            holidays: [
                { start: "2025-01-01", end: "2025-01-01", name: "元旦" },
                { start: "2025-01-28", end: "2025-02-04", name: "春节" },
                { start: "2025-04-04", end: "2025-04-06", name: "清明" },
                { start: "2025-05-01", end: "2025-05-05", name: "劳动节" },
                { start: "2025-05-31", end: "2025-06-02", name: "端午" },
                { start: "2025-10-01", end: "2025-10-08", name: "国庆中秋" }
            ],
            workdays: ["2025-01-26", "2025-02-08", "2025-04-27", "2025-09-28", "2025-10-11"]
        },
        2026: {
            holidays: [
                { start: "2026-01-01", end: "2026-01-03", name: "元旦" },
                { start: "2026-02-15", end: "2026-02-23", name: "春节" },
                { start: "2026-04-04", end: "2026-04-06", name: "清明" },
                { start: "2026-05-01", end: "2026-05-05", name: "劳动节" },
                { start: "2026-06-19", end: "2026-06-21", name: "端午" },
                { start: "2026-09-25", end: "2026-09-27", name: "中秋" },
                { start: "2026-10-01", end: "2026-10-07", name: "国庆" }
            ],
            workdays: ["2026-01-04", "2026-02-14", "2026-02-28", "2026-05-09", "2026-09-20", "2026-10-10"]
        }
    };

    var DAY_MAP = {};

    function pad(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function parseYmd(str) {
        var p = str.split("-");
        return new Date(+p[0], +p[1] - 1, +p[2]);
    }

    function ymdFromDate(d) {
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }

    function addDays(ymd, delta) {
        var d = parseYmd(ymd);
        d.setDate(d.getDate() + delta);
        return ymdFromDate(d);
    }

    function buildMap() {
        Object.keys(YEAR_PLANS).forEach(function (year) {
            var plan = YEAR_PLANS[year];
            plan.holidays.forEach(function (item) {
                var cur = item.start;
                while (cur <= item.end) {
                    DAY_MAP[cur] = { name: item.name, type: "holiday" };
                    cur = addDays(cur, 1);
                }
            });
            plan.workdays.forEach(function (ymd) {
                DAY_MAP[ymd] = { name: "班", type: "workday" };
            });
        });
    }

    buildMap();

    function get(ymd) {
        return DAY_MAP[ymd] || null;
    }

    function isWeekend(year, month, day) {
        var w = new Date(year, month, day).getDay();
        return w === 0 || w === 6;
    }

    function getDayMeta(year, month, day) {
        var ymd = year + "-" + pad(month + 1) + "-" + pad(day);
        var holiday = get(ymd);
        var weekend = isWeekend(year, month, day);
        var isWorkdayOverride = holiday && holiday.type === "workday";
        var isHoliday = holiday && holiday.type === "holiday";
        var isRestDay = (weekend && !isWorkdayOverride) || isHoliday;

        return {
            ymd: ymd,
            holiday: holiday,
            isWeekend: weekend,
            isRestDay: isRestDay,
            isWorkdayOverride: isWorkdayOverride,
            isHoliday: isHoliday
        };
    }

    function getHolidaysForYear(year) {
        var plan = YEAR_PLANS[year];
        if (!plan) return [];
        return plan.holidays.map(function (item) {
            return {
                name: item.name,
                start: item.start,
                end: item.end,
                year: year
            };
        });
    }

    function getAllHolidayOptions() {
        var list = [];
        Object.keys(YEAR_PLANS)
            .sort(function (a, b) {
                return +a - +b;
            })
            .forEach(function (year) {
                getHolidaysForYear(+year).forEach(function (item) {
                    list.push({
                        name: item.name,
                        start: item.start,
                        end: item.end,
                        year: +year,
                        label: year + "年" + item.name
                    });
                });
            });
        return list;
    }

    function daysBetweenYmd(fromYmd, toYmd) {
        var a = parseYmd(fromYmd);
        var b = parseYmd(toYmd);
        a.setHours(0, 0, 0, 0);
        b.setHours(0, 0, 0, 0);
        return Math.round((b.getTime() - a.getTime()) / 86400000);
    }

    /** 距离下一法定节假日（或当前假期）的天数 */
    function getNextHolidayCountdown(fromDate) {
        var d = fromDate instanceof Date ? fromDate : new Date();
        var todayYmd = ymdFromDate(d);
        var all = getAllHolidayOptions();
        var i;
        for (i = 0; i < all.length; i++) {
            var item = all[i];
            if (item.end < todayYmd) continue;
            if (todayYmd >= item.start && todayYmd <= item.end) {
                return {
                    name: item.name,
                    year: item.year,
                    label: item.label,
                    start: item.start,
                    daysLeft: 0,
                    inProgress: true
                };
            }
            var left = daysBetweenYmd(todayYmd, item.start);
            if (left >= 0) {
                return {
                    name: item.name,
                    year: item.year,
                    label: item.label,
                    start: item.start,
                    daysLeft: left,
                    inProgress: false
                };
            }
        }
        return null;
    }

    global.ToolHolidays = {
        get: get,
        getDayMeta: getDayMeta,
        isWeekend: isWeekend,
        getHolidaysForYear: getHolidaysForYear,
        getAllHolidayOptions: getAllHolidayOptions,
        getNextHolidayCountdown: getNextHolidayCountdown,
        parseYmd: parseYmd
    };
})(typeof window !== "undefined" ? window : this);
