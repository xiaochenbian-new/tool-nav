' 隐藏窗口、后台运行 gitee→github 同步（给 Win 任务计划程序用：wscript 调用本文件，无弹窗）。
' Run 第 2 个参数 0 = 隐藏窗口；第 3 个参数 False = 不等待（在后台执行 push 后立即返回）。
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\16372\IdeaProjects\cursor-tools-nav\tool-nav"
sh.Run "git push github offline master", 0, False
