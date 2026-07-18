/**
 * 小米钱包 · 看视频自动领取
 * 运行环境：Auto.js 6 / AutoX.js（需开启无障碍、悬浮窗、后台运行权限）
 *
 * 用法：将本目录（main.js + config.js）复制到手机 Auto.js 的 scripts 目录后运行 main.js
 */
"ui";

var config = require("./config.js");

// ── 日志 ──────────────────────────────────────────────
var logs = [];
function log(msg) {
    var line = "[" + new Date().toLocaleTimeString() + "] " + msg;
    logs.push(line);
    console.log(line);
    if (config.showFloaty && typeof floatyWin !== "undefined" && floatyWin) {
        ui.run(function () {
            try {
                floatyWin.log.setText(logs.slice(-8).join("\n"));
            } catch (e) { /* ignore */ }
        });
    }
}

// ── 悬浮窗 ────────────────────────────────────────────
var floatyWin = null;
if (config.showFloaty) {
    floatyWin = floaty.window(
        <frame gravity="left|top" w="*" h="auto">
            <vertical bg="#cc1f2a44" padding="8" w="280">
                <text text="小米钱包视频助手" textColor="#ffffff" textSize="13sp" textStyle="bold"/>
                <text id="log" text="准备中…" textColor="#cce0ff" textSize="11sp" marginTop="4"/>
                <horizontal marginTop="6">
                    <button id="btnStop" text="停止" w="*" style="Widget.AppCompat.Button.Colored"/>
                </horizontal>
            </vertical>
        </frame>
    );
    floatyWin.setPosition(20, 120);
    floatyWin.btnStop.click(function () {
        log("用户手动停止");
        engines.myEngine().forceStop();
    });
}

// ── 工具函数 ──────────────────────────────────────────
var running = true;

function sleepMs(ms) {
    sleep(ms);
}

function regexFromList(list) {
    return new RegExp("(" + list.map(function (s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("|") + ")");
}

function findAndClick(textList, timeout) {
    timeout = timeout || 3000;
    var re = regexFromList(textList);
    var node = textMatches(re).clickable(true).findOne(timeout);
    if (!node) node = textMatches(re).findOne(timeout);
    if (node) {
        log("点击: " + node.text());
        clickNode(node);
        sleepMs(config.stepDelayMs);
        return true;
    }
    return false;
}

function clickNode(node) {
    if (!node) return false;
    var b = node.bounds();
    if (b && b.centerX() > 0) {
        click(b.centerX(), b.centerY());
        return true;
    }
    return node.click();
}

function dismissPopups() {
    config.dismissTexts.forEach(function (t) {
        var n = text(t).clickable(true).findOnce();
        if (n) {
            log("关闭弹窗: " + t);
            clickNode(n);
            sleepMs(800);
        }
    });
}

function isTaskDone() {
    var re = regexFromList(config.doneTexts);
    return textMatches(re).exists();
}

function dumpClickables() {
    log("── 当前可点击控件 ──");
    clickable(true).find().slice(0, 15).forEach(function (n) {
        var t = n.text() || n.desc() || n.id() || "(无文本)";
        log("  · " + t);
    });
}

function ensureAccessibility() {
    auto.waitFor();
    if (!auto.service) {
        toast("请先开启无障碍服务");
        app.startActivity({
            action: "android.settings.ACCESSIBILITY_SETTINGS"
        });
        exit();
    }
}

function launchWallet() {
    log("启动小米钱包…");
    app.launchPackage(config.packageName);
    sleepMs(config.launchWaitMs);
    if (currentPackage() !== config.packageName) {
        log("未能进入小米钱包，请确认已安装并登录");
        return false;
    }
    return true;
}

function navigateToTasks() {
    dismissPopups();
    for (var i = 0; i < config.taskEntryTexts.length; i++) {
        if (findAndClick([config.taskEntryTexts[i]], 2000)) {
            sleepMs(config.stepDelayMs);
            return true;
        }
    }
    log("未找到任务入口，尝试在当前页直接寻找视频任务");
    return true;
}

function runOneRound(round) {
    log("── 第 " + round + " 轮 ──");
    if (config.debug) dumpClickables();

    if (isTaskDone()) {
        log("任务已全部完成");
        return false;
    }

    dismissPopups();

    // 尝试点击「去看视频」类按钮
    var started = findAndClick(config.startVideoTexts, 4000);
    if (!started) {
        // 列表里可能有「看视频 +N积分」样式，用 desc/text 模糊匹配
        var fuzzy = textMatches(/视频/).clickable(true).findOnce();
        if (fuzzy) {
            log("模糊匹配视频任务: " + fuzzy.text());
            clickNode(fuzzy);
            sleepMs(config.stepDelayMs);
            started = true;
        }
    }

    if (!started) {
        log("本轮未找到可开始的视频任务");
        return false;
    }

    // 等待视频/广告播放
    log("等待视频播放 " + config.videoWaitSec + " 秒…");
    sleepMs(config.videoWaitSec * 1000);

    dismissPopups();

    // 领取奖励
    var claimed = findAndClick(config.claimTexts, 5000);
    if (!claimed) {
        // 有些版本看完自动弹领取窗
        var claimBtn = textMatches(/领|收下|获得/).clickable(true).findOnce();
        if (claimBtn) {
            log("领取: " + claimBtn.text());
            clickNode(claimBtn);
            claimed = true;
            sleepMs(config.stepDelayMs);
        }
    }

    if (claimed) {
        log("第 " + round + " 轮领取成功");
    } else {
        log("第 " + round + " 轮未检测到领取按钮，可能已自动到账");
    }

    dismissPopups();
    back();
    sleepMs(config.stepDelayMs);
    return true;
}

// ── 主流程 ────────────────────────────────────────────
function main() {
    ensureAccessibility();
    log("脚本启动");

    if (!launchWallet()) return;

    if (!navigateToTasks()) {
        log("无法进入任务页，请手动打开「任务中心」后重新运行");
        return;
    }

    var round = 0;
    var limit = config.maxRounds || 999;

    while (running && round < limit) {
        round++;
        var cont = runOneRound(round);
        if (!cont) break;
        sleepMs(config.stepDelayMs);
    }

    log("全部完成，共执行 " + round + " 轮");
    toast("小米钱包视频任务完成");
}

threads.start(function () {
    try {
        main();
    } catch (e) {
        log("异常: " + e);
        console.error(e);
    }
});
