' Hidden background sync for Tool Scheduler (run with wscript, no console window).
' Param 0 = hidden window; True = wait for git push to finish so the task completes cleanly.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\16372\IdeaProjects\cursor-tools-nav\tool-nav"
sh.Run "git push github offline master", 0, True
