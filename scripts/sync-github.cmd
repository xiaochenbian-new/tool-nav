@echo off
REM tool-nav local sync: push offline/master to github (SSH).
REM Bypasses gitee's 429 rate-limit on GitHub CI IPs by using your local machine's IP.
REM Run manually or schedule with Windows Task Scheduler.

cd /d "%~dp0.."
echo [sync-github] cwd=%CD%
git push github offline master
echo [sync-github] exit=%errorlevel%
