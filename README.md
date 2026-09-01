# tool-nav 工具导航

一个**离线优先**的开发者工具合集，以 **uTools 插件**为主要载体，也可作为纯静态网页使用。所有第三方库（Monaco、CodeMirror、xlsx、mathjs、KaTeX 等）均已本地化，`file://` 下可直接运行，离线可用。

- 载体：`plugin.json`（uTools feature: tools）
- 入口：`index.html`（工具导航外壳，含收藏栏 / 搜索 / 计算器 / 日历）
- 工具页：`pages/*.html`（48 个独立工具页，每个为自包含 HTML）
- 离线依赖：`vendor/`（由 `scripts/copy-vendor-all.cjs` 从 node_modules 生成）
- 打包：`scripts/pack-utools.cjs` 生成 `dist-utools/`（uTools 插件包）

## 本地开发

```bash
npm install          # postinstall 会自动生成 vendor/
npm run serve        # 本地工具站 + 跨域代理: http://localhost:8765
npm run pack:utools  # 生成 uTools 可打包目录 dist-utools/
```

> 在 uTools 开发者工具中，将 plugin.json 指向 `dist-utools/plugin.json` 即可打包。

## 部署架构（自动同步 + 自动发布 GitHub Pages）

```
你 push 到 gitee（源, origin）
   └─ sync-from-gitee 工作流（github 上每 15 分钟，workflow_dispatch 可手动触发）
        └─ 把 gitee 的 offline/master/online 分支镜像到 github
             └─ 该 push 触发 deploy-pages 工作流
                  └─ 打包静态文件（index.html + pages + vendor）→ 发布到 GitHub Pages
```

### 两个远程

| 名称 | 地址 | 用途 |
|---|---|---|
| `origin` | `https://gitee.com/xiaochenbian/tool-nav.git` | 源仓库（手动推送） |
| `github` | `git@github.com:xiaochenbian-new/tool-nav.git` | GitHub 镜像（SSH 推送更稳定） |

> 注：本机到 `github.com:443`（HTTPS）不稳定时，用 **SSH** 推送更可靠：
> ```bash
> git push github <branch>
> ```

### GitHub Actions 工作流（`.github/workflows/`）

- **`deploy-pages.yml`**：在 push 到 `offline`/`master`/`online` 时，把静态站点打包并发布到 **GitHub Pages**。
  - 需要的 Pages 地址（手动开启后生效）：`https://xiaochenbian-new.github.io/tool-nav/`
  - 开启方法：仓库 `Settings → Pages → Source` 选择 **GitHub Actions**。
- **`sync-from-gitee.yml`**：每 15 分钟把 gitee 的 `offline`/`master`/`online` 三个内容分支镜像到 github；**已排除含授权逻辑的 `app` 分支**。

### 分支说明

- `offline`（当前开发主分支，含 GitHub 工作流）
- `master` / `online`（内容分支，随同步镜像）
- `app`（Android 项目，含激活码逻辑，**不**参与 github 同步；原内容保留在 gitee 的 `app` 分支）

## 发布前置条件

1. **gitee 仓库为公开**：`sync-from-gitee` 需要能匿名 clone gitee 才能同步。
2. **开启 GitHub Pages（Source: GitHub Actions）**：`deploy-pages` 才能发布。
3. 首次需把含工作流的 `offline` 分支推到 github（引导），此后由 `sync-from-gitee` 自动维持同步。

## 历史与体积说明

仓库历史已重写，剔除了历史中混入的 `app/android-sdk`、历史 `node_modules`、`photo-background-change`（Imgly AI 模型）等膨胀对象，仓库体积由约 2 GiB 降至约 10 MiB，便于推送与 CI 检出。

---

本仓库文件（`index.html`、`pages/`、`scripts/`、`vendor/`、`.github/`、`plugin.json`）均为离线工具站所需静态内容。
