# Gitee → GitHub 自动同步配置手册

一份通用的、可手动复制的操作指南：让你把代码推送到 **gitee（源仓库）** 后，自动镜像到 **github（GitHub 仓库）**，并可选地发布到 **GitHub Pages**。以下以 `<OWNER>/<REPO>` 代表你的 gitee/github 仓库所属主与仓库名，实际使用时替换。

---

## 目录

- [1. 前置准备](#1-前置准备)
- [2. 本机关联两个远程仓库](#2-本机关联两个远程仓库)
- [3. 创建 gitee→github 自动同步工作流](#3-创建-gitee→github-自动同步工作流)
- [4. 设置 GitHub 默认分支（关键）](#4-设置-github-默认分支关键)
- [5. gitee 为私有仓库时的令牌配置](#5-gitee-为私有仓库时的令牌配置)
- [6. （可选）发布到 GitHub Pages](#6-可选发布到-github-pages)
- [7. 常用命令速查](#7-常用命令速查)
- [8. 安全与体积注意事项](#8-安全与体积注意事项)
- [9. 常见问题排查](#9-常见问题排查)
- [10. 本机同步方案（绕过 gitee 对 CI 的 429 限流，推荐）](#10-本机同步方案绕过-gitee-对-ci-的-429-限流推荐)

---

## 1. 前置准备

- **一个 gitee 仓库**（源码仓库，`https://gitee.com/<OWNER>/<REPO>`）
- **一个 github 仓库**（镜像 + 发布，`https://github.com/<OWNER>/<REPO>`）
- **本机能访问 gitee**；**能访问 github**（本手册推荐用 **SSH** 访问 github，更稳定）
- github 账号已配置 **SSH 公钥**

生成/配置 SSH 密钥（若没有）：
```bash
ssh-keygen -t ed25519 -C "you@example.com"     # 一路回车
cat ~/.ssh/id_ed25519.pub                        # 复制到 github → Settings → SSH and GPG keys
```

---

## 2. 本机关联两个远程仓库

```bash
cd <你的项目目录>

# 添加 gitee（源，HTTP，可用账号密码/令牌）
git remote add origin https://gitee.com/<OWNER>/<REPO>.git

# 添加 github（镜像，推荐 SSH）
git remote add github git@github.com:<OWNER>/<REPO>.git

# 查看
git remote -v

# 推送到 gitee
git push origin <branch>

# 推送到 github（SSH）
git push github <branch>
```

> 若要同时推送两个远程，可加一个别名：
> ```bash
> git remote add both git@github.com:<OWNER>/<REPO>.git
> # 无法直接给多个远程建别名推送，但可配合 git push --all 或分别 push；
> # 更推荐：只用 gitee 作为常用源 + 下文的工作流自动同步到 github。
> ```

---

## 3. 创建 gitee→github 自动同步工作流

在仓库里新建 `.github/workflows/sync-from-gitee.yml`：

```yaml
name: Sync gitee to github

# 每 15 分钟把 gitee 的分支镜像到本仓库（github）。
# 也可在 Actions 页手动 Run workflow。
on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: sync-gitee
  cancel-in-progress: true

jobs:
  mirror:
    runs-on: ubuntu-latest
    steps:
      - name: Sync content branches from gitee to this repo
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # gitee 私有仓库时需要配 GITEE_TOKEN（见第 5 节）；公开可不配
          GITEE_TOKEN: ${{ secrets.GITEE_TOKEN }}
        run: |
          set -e
          if [ -n "$GITEE_TOKEN" ]; then
            GITEE_URL="https://oauth2:${GITEE_TOKEN}@gitee.com/<OWNER>/<REPO>.git"
          else
            GITEE_URL="https://gitee.com/<OWNER>/<REPO>.git"
          fi
          git clone --mirror "$GITEE_URL" tmp
          cd tmp
          # 这里列出要同步到 github 的分支；按需增删/修改
          git push --force \
            "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" \
            refs/heads/offline:refs/heads/offline \
            refs/heads/master:refs/heads/master \
            refs/heads/online:refs/heads/online
```

**要修改的地方：**
- `<OWNER>/<REPO>`：你的 gitee 仓库
- 第 32–34 行的分支列表：改成你想同步到 github 的分支（`git branch` 查看本地分支）
- 若想排除某些分支（如含密钥/授权逻辑），就从 `git push` 列表里去掉即可

提交并推送：
```bash
git add .github/workflows/sync-from-gitee.yml
git commit -m "ci: add gitee->github auto sync"
git push origin <branch>     # 推 gitee（源）
git push github <branch>     # 推 github（用于引导，让工作流先存在于 github）
```

> **引导原理**：定时任务只从"默认分支"运行，且工作流文件必须已在 github 上（首次需手动推一次）。之后每次 gitee 有更新，工作流就会拉 gitee 并刷到 github。

> ⚠️ **重要（gitee 会封 GitHub CI 的 IP）**：gitee 对 **GitHub Actions 数据中心 IP 段**做了防滥用限流，GitHub Actions 里 `git clone https://gitee.com/...`（无论公开还是带令牌）**经常返回 `HTTP 429`（Too Many Requests）**，导致定时同步几乎必失败。日志典型报错为 `error: RPC failed; HTTP 429` 和 `fatal: expected flush after ref listing`。
> 因此 **CI 定时克隆 gitee 不可靠**。若遇到 429，请改用下面的 **「本机同步」方案（第 10 节）**，用你本机 IP 推 github（本机 IP 一般不会被限流）。

---

## 4. 设置 GitHub 默认分支（关键）

**GitHub 定时任务（cron）只在仓库的"默认分支"上运行。** 因此工作流必须位于默认分支。

检查默认分支：
```bash
git ls-remote --symref github HEAD   # 输出如: ref: refs/heads/offline	HEAD
```
如果默认分支不是放工作流的那个分支，有两种处理：
- **把工作流放到默认分支**（最简单，通常默认分支就是你的主开发分支）
- 或在 github 仓库 **Settings → General → Default branch** 改成放工作流的分支

> 若你多个分支都要定时同步，可以把工作流同时放到每个分支，或统一放到默认分支。**推荐：只在默认分支放工作流，且它列出的分支就是你要同步的分支。**

---

## 5. gitee 为私有仓库时的令牌配置

若 gitee 仓库是**私有**的，工作流无法匿名 clone，会失败。两步解决：

1. **生成 gitee 私人令牌**：`gitee.com/<OWNER>` → 设置 → 安全设置 → 私人令牌 → 生成新令牌，勾选 **`projects`** 读权限，复制令牌。

2. **把令牌加到 github 仓库的 Actions 密钥**：
   `github.com/<OWNER>/<REPO>` → **Settings → Secrets and variables → Actions → New repository secret**
   - **Name**: `GITEE_TOKEN`
   - **Secret**: 粘贴 gitee 令牌

> 之后工作流会以 `https://oauth2:<令牌>@gitee.com/...` 拉取私有仓库。
> 若你的 gitee 令牌不支持 `oauth2:` 前缀，把工作流里的 URL 改成 `https://<用户名>:<令牌>@gitee.com/...`。

**或者**让 gitee 仓库公开（仓库设置 → 基本设置 → 公开），则无需令牌，工作流直接匿名 clone。

---

## 6. （可选）发布到 GitHub Pages

如果这个项目是个**静态站点**（如纯 HTML 工具站），可以加 `deploy-pages.yml` 自动发布：

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [offline, master, online]   # 改成你的发布分支
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Stage static site
        run: |
          mkdir -p dist-site
          cp -r index.html plugin.json pages vendor dist-site/   # 按你的站点修改
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist-site }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

启用 Pages：仓库 **Settings → Pages → Source → GitHub Actions**。
发布后地址：`https://<OWNER>.github.io/<REPO>/`。

> `sync-from-gitee` 把 gitee 同步到 github 会触发 push，进而自动触发 `deploy-pages` 重新发布，形成：**push gitee → 同步 github → 发布 Pages** 的全自动闭环。

---

## 7. 常用命令速查

```bash
# 查看远程
git remote -v

# 推送到 gitee（源）
git push origin <branch>

# 推送到 github（SSH 更稳）
git push github <branch>

# 手动触发一次同步（在仓库 Actions → "Sync gitee to github" → Run workflow）
# 查看工作流运行结果（Actions 标签页）

# （可选）把 github 改成 SSH 以免 HTTPS 被重置
git remote set-url github git@github.com:<OWNER>/<REPO>.git
```

---

## 8. 安全与体积注意事项

- **不要提交大文件/构建产物**：如 `node_modules/`、Android SDK、AI 模型、`bin/`、`dist/` 等应加入 `.gitignore`。历史一旦混入大文件，会让仓库体积膨胀到难以推送（GitHub 对单次推送/单文件有上限）。
- **如历史已膨胀**：可用 `git filter-branch` / `git filter-repo` 从所有提交剔除大路径，再 `git gc` 压缩，最后 `git push --force`（会改变所有 commit 哈希）。
- **敏感分支排除**：含密钥/授权逻辑的分支不要加进同步列表。
- **TLS 证书校验**：若曾用 `git config --global http.sslVerify false`，恢复为 `true`：
  ```bash
  git config --global http.sslVerify true
  ```
- **推送稳定性**：github HTTPS 在某些网络下会被重置（errno 10054），改用 SSH 或 `git config http.version HTTP/1.1`。

---

## 9. 常见问题排查

| 现象 | 可能原因 | 处理 |
|---|---|---|
| `Sync gitee to github` 一直红色 | gitee 私有，匿名 clone 失败 | 配 `GITEE_TOKEN` 或把 gitee 公开（见第 5 节） |
| 定时任务不跑 | 工作流不在**默认分支** | 把工作流放到默认分支，或改默认分支（见第 4 节） |
| `deploy-pages` 部署失败 | 未启用 Pages 或 Pages Source 不是 GitHub Actions | Settings → Pages → Source 选 **GitHub Actions** |
| github HTTPS 推送被重置 | 网络/HTTP2 问题 | 用 SSH，或 `git config http.version HTTP/1.1`、调大 `http.postBuffer` |
| 推送被拒 / 体积超大 | 历史混入大文件 | 重写历史剔除大路径后 `--force` 推送 |
| 同步后 github 分支被强制覆盖 | 正常 —— 同步就是镜像 gitee 到 github | 确认同步列表只含你想要的分支 |

---

## 整体链路（小结）

```
你在本机 push 到 gitee（源仓库）
        │
        ▼
（≤15 分钟）GitHub Actions: sync-from-gitee
        │  拉取 gitee 的指定分支 → force-push 到 github
        ▼
github 分支更新
        │
        ▼（若配置了 Pages）
GitHub Actions: deploy-pages → 发布 GitHub Pages
```

> 关键点回顾：① 工作流文件放在 github **默认分支**；② gitee 私有需配 `GITEE_TOKEN`；③ 要发布 Pages 需在 Settings 开启 **Source: GitHub Actions**；④ **gitee 常 429 GitHub CI IP，同步优先用第 10 节本机方案。**

---

## 10. 本机同步方案（绕过 gitee 对 CI 的 429 限流，推荐）

当 gitee 对 GitHub Actions 限流（HTTP 429）时，让同步走你**本机**（本机 IP 一般不被限流）。

### 方案 A：一条命令同时推两个仓库（最简单）
```bash
# 配置一次：定义 pushall = 先推 gitee 再推 github
git config --global alias.pushall "push origin && push github"

# 以后每次提交后：
git pushall <分支>      # 等价 git push origin <分支> && git push github <分支>
```

### 方案 B：本机定时自动同步（真全自动）
在仓库建一个同步脚本（如 `scripts/sync-github.cmd`）：
```bat
@echo off
REM Push offline/master to github (SSH). Bypasses gitee 429 on CI by using your local IP.
cd /d "%~dp0.."
git push github offline master
echo [sync-github] exit=%errorlevel%
```
然后用 **Windows 任务计划程序** 每 15 分钟运行它：
- Win+R → `taskschd.msc` → 创建基本任务 → 触发器选 **Daily / 重复间隔 15 分钟 / 无限期** → 操作"启动程序"填该 `.cmd` 路径 → 完成。

> 也可用 PowerShell 一键创建任务（免手点）：
> ```powershell
> $tn   = "sync github"
> $a    = New-ScheduledTaskAction -Execute "C:\path\to\scripts\sync-github.cmd"
> # 注意：开始时间要取“未来”（AddMinutes(2)），否则若落在过去，任务不会按间隔正常触发
> $t    = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::FromDays(3650))
> $p    = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
> Register-ScheduledTask -TaskName $tn -Action $a -Trigger $t -Principal $p -Force
> ```

**前提**：你 push gitee 也是在这台机器的这个项目目录（这样本机仓库始终与 gitee 一致，脚本推 github 即最新）。本机 push 到 github 后会触发 github 的 `deploy-pages` 重新发布 Pages。

> **避免弹窗（建议）**：任务计划直接运行 `.cmd` 会弹出 cmd 控制台窗口，影响使用。改成用 **`wscript` 运行一个隐藏的 VBScript**。**注意：VBScript 文件里不要写中文注释**（否则 wscript 按 ANSI 解析 UTF-8 中文会报"缺少对象"等运行错误），内容保持纯 ASCII。在仓库建 `sync-github-hidden.vbs`：
> ```vbs
> Set sh = CreateObject("WScript.Shell")
> sh.CurrentDirectory = "C:\path\to\project"
> sh.Run "git push github offline master", 0, True
> ```
> 说明：`0` = 隐藏窗口（后台无弹窗）；`True` = 等待 git push 执行完再结束（保证任务正常收尾、不阻塞下次定时触发）。
> 然后把任务的「操作」改为：程序 `wscript.exe`，参数 `"C:\path\to\scripts\sync-github-hidden.vbs"`。用 PowerShell 更新：
> ```powershell
> $a = New-ScheduledTaskAction -Execute "wscript.exe" -Argument '"C:\path\to\scripts\sync-github-hidden.vbs"'
> Set-ScheduledTask -TaskName "sync github" -Action $a
> ```
> （本次已在 tool-nav 项目里做好 `scripts/sync-github-hidden.vbs` 并已按此配置任务。）

### 如何查看 / 管理这个任务计划

**PowerShell 查看：**
```powershell
Get-ScheduledTask -TaskName "sync github"                      # 基本信息
(Get-ScheduledTask -TaskName "sync github").Triggers           # 触发器（每15分钟）
(Get-ScheduledTask -TaskName "sync github").Actions            # 执行的脚本路径
Get-ScheduledTaskInfo -TaskName "sync github"                  # 上次/下次运行时间、结果
Get-ScheduledTask | Where-Object TaskName -like "*github*"     # 列出所有含 github 的任务
```

**图形界面：** Win+R → `taskschd.msc` → 任务计划程序库 → 找到该任务双击查看。

**命令行详情：**
```bash
schtasks /query /tn "sync github" /v /fo list
```

**手动触发/停止：**
```powershell
Start-ScheduledTask  -TaskName "sync github"    # 立即跑一次
Stop-ScheduledTask   -TaskName "sync github"    # 停止
Unregister-ScheduledTask -TaskName "sync github" -Confirm:$false   # 删除任务
```


