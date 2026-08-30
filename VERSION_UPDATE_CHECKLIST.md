# 版本更新检查清单（Version Update Checklist）

> 每次发布新版本时，必须逐项检查并更新以下所有位置。
> 本清单是项目的长期维护范式，任何版本更新都不得跳过。

## 一、代码内版本号

| # | 文件 | 位置 | 说明 |
|---|------|------|------|
| 1 | `package.json` | `version` 字段 | npm 包版本号 |
| 2 | `lib/client.js` | `const PLUGIN_VERSION = "x.x.x"` | 帮助中心弹窗显示的「当前零号工具版本」 |

## 二、文档版本号与说明

| # | 文件 | 需要更新的内容 |
|---|------|----------------|
| 3 | `README.md` | ① 当前版本号 ② 新增/修复说明（在 v1.6.1 等历史记录上方插入新版本说明） ③ 系统要求（如有变化） ④ 安装步骤（如有变化） ⑤ 目录结构（如有新增文件） |
| 4 | `README.en.md` | 与 README.md 完全同步（英文版），**不得遗漏** |

## 三、帮助中心数据

| # | 文件 | 说明 |
|---|------|------|
| 5 | `help.json` | 如帮助内容有更新，需更新 `version` 和 `updatedAt` 字段；同时需同步到 GitHub Pages（`ai-yukin.github.io/dsh-0-tools/help.json`） |

## 四、Git 标签与推送

| # | 操作 | 说明 |
|---|------|------|
| 6 | `git tag -a vx.x.x -m "..."` | 打版本标签 |
| 7 | `git push origin main --tags` | 推送到 GitHub（main 分支 + tag） |
| 8 | `git push gitee main --tags` | 推送到 Gitee main 分支 |
| 9 | `git push gitee main:master --tags` | 推送到 Gitee **master** 分支（Gitee 默认分支是 master，必须同步！） |

## 五、外部收录平台同步

| # | 平台 | 仓库 | 需要更新的文件 |
|---|------|------|----------------|
| 10 | awesome-dsh-plugin | https://github.com/ai-yukin/awesome-dsh-plugin | `README.md`（英文描述）、`README.zh.md`（中文描述）、`data/plugins/ai-yukin__dsh-0-tools.yml`（中英文 description） |

## 六、发布后验证

| # | 验证项 | 验证方式 |
|---|--------|----------|
| 11 | GitHub 页面版本号 | 打开 https://github.com/ai-yukin/dsh-0-tools ，确认 README 显示新版本 |
| 12 | Gitee 页面版本号 | 打开 https://gitee.com/ai-yukin/dsh-0-tools ，确认 README 显示新版本（注意 Gitee 默认分支是 master） |
| 13 | Tag 存在 | `git ls-remote --tags origin` 和 `git ls-remote --tags gitee` 确认新版本 tag |
| 14 | 帮助中心版本 | 启动 DSH，打开帮助中心，确认「当前零号工具版本」显示新版本 |
| 15 | 全局搜索旧版本号 | `grep -r "旧版本号" --include="*.{js,json,md,yml}" .` 确认无遗漏 |

## 常见遗漏提醒

- **README.en.md**：最容易被遗漏的文件，每次必须与 README.md 同步更新
- **lib/client.js PLUGIN_VERSION**：帮助中心显示的版本号，容易被遗忘
- **Gitee master 分支**：Gitee 默认分支是 master，不是 main，必须同时推送 main:master
- **awesome-dsh-plugin**：外部收录平台的描述需要同步更新
