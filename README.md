# dsh-0-tools 零号工具

## 零号工具是什么

零号工具是面向编程零基础的用户、初次使用 DeepSeek Harness（以下简称 DSH）场景而设计的工具，具有「零门槛、零费用、零失控」的特性，希望帮助零基础用户获得更好的使用体验。

## 主要功能

1. **【零门槛】**一键安装 DSH 及本工具；
2. **【零费用】**一键为 DSH 安装配置可免费调用 API 的大模型（目前有智谱 GLM 和 OpenRouter Ox-Alpha）；
3. **【零失控】**若选择调用 DeepSeek 模型 API，将在 DSH 的界面实时提示 API 费用是原价还是半价；
4. **【零门槛】**为了让新手更快学习掌握 DSH，在帮助中心提供了靠谱信源的相关资讯。

## 当前版本与兼容范围

- 当前版本：**v1.3.2**
- 兼容 DSH 版本：`0.1.0-rc.7` ～ `0.1.1-rc.2`
- **系统要求**：仅支持 **Windows 10 / Windows 11** 系统；暂不支持 macOS（苹果电脑）和 Linux 系统。

## 安装与使用（图文步骤）

### 第 1 步：双击运行 install.bat

- 电脑**已经装好 DSH**：脚本会自动检测并跳过安装，直接完成本工具的安装；
- 电脑**还没装 DSH**：脚本会自动扫描运行环境，补齐缺失的环境后自动安装 DSH；
- 安装成功后，脚本会自动在**桌面生成一个「DeepSeek Harness」快捷方式**。

> 小提示：install.bat 是纯文本脚本，可右键 →「打开方式 → 记事本」查看全部内容后再运行（内容透明可审）。从网上下载的脚本没有数字签名，Windows 可能弹出 SmartScreen 提示（"Windows 已保护你的电脑"），点「更多信息 → 仍要运行」即可——这是 Windows 对无签名脚本的统一提示，不是病毒警告。

### 第 2 步：打开 DSH 界面

双击桌面的「DeepSeek Harness」快捷方式，浏览器会自动打开 DSH 的网页界面，在界面左下方可看到「点此处配置API免费模型」按钮。

![DSH 主界面](screenshots/1.png)

### 第 3 步：进入零费用·API配置中心

点击「点此处配置API免费模型」按钮，进入「**零费用·API配置中心**」，可以看到目前可以配置的免费模型。

![零费用·API配置中心](screenshots/2.png)

### 第 4 步：申请并填写 API Key

根据「零费用·API配置中心」页面引导，去对应平台申请注册并获取免费模型的 API Key，填入并启用，可以选择安装一个或多个免费模型。

![模型选择下拉菜单](screenshots/3.png)

### 第 5 步：切换到免费模型，零费用玩转 DSH

配置好免费模型后，返回 DSH 界面，在模型选择处切换刚才配置的免费模型，即可零费用开始使用 DSH。

### 第 6 步：使用付费 DeepSeek 模型

如果你决定付费使用，并已申请、购买 DeepSeek 模型的 API，可在 DSH 界面左下角点「设置」，找到「模型」，在 DeepSeek 处点「编辑」，填入 DeepSeek 模型的 API 密钥。

### 第 7 步：DeepSeek 计费提醒

当你在 DSH 界面切换选择了 DeepSeek 模型，界面左下角会实时显示计价提醒，根据 DeepSeek 官方 API 调用的高峰/空闲时段，提示「当前高峰时段API为原价」或「当前空闲时段API为半价」，为你提供「零失控」的费用保驾护航。

![高峰时段 API 为原价](screenshots/4.png)

![空闲时段 API 为半价](screenshots/5.png)

## 国内镜像下载地址

本仓库为中国大陆用户提供了 Gitee 镜像：

- **Gitee 镜像**：`https://gitee.com/ai-yukin/dsh-0-tools`（即将开放）

说明：

- 本仓库以 **GitHub 为主源仓库**（`https://github.com/ai-yukin/dsh-0-tools`），Gitee 为自动同步的国内镜像，内容与主仓库保持一致；
- 镜像仓库目前正在准备中，主仓库内容更新完成后将立即开放，敬请期待；
- 如需反馈问题或建议，请在 GitHub 主仓库的 Issues 中提交。

## 兼容性

本插件针对以下 DSH 版本开发与验证：

| DSH 版本 | 状态 |
|------|------|
| `0.1.0-rc.7` | 开发基线（依赖声明 `^0.1.0-rc.7`） |
| `0.1.1-rc.2` | 已实测适配通过（页面加载 / 计价条 / 模型选择器 / 设置页签） |

> 安装前请确认 DSH 版本在 `0.1.0-rc.7` ～ `0.1.1-rc.2` 范围内（查看最新版本：`npm view @deepseek-ai/dsh versions`）。DSH 发布新大版本（如 `0.2.x`）后，请先查看本插件 Release 说明确认适配，再决定是否升级。

## 目录结构

```
dsh-0-tools/
├── lib/
│   ├── index.js     # host 端：127.0.0.1:3090~3099 回环服务（/status /configure /uninstall）
│   └── client.js    # 浏览器端：左下角工具条 + 设置页签「零号工具」
├── cordis.patch.yml # web profile 注入声明
├── package.json
├── help.json        # 帮助中心在线数据源（托管于 GitHub Pages）
└── install.bat      # 一键安装 + 启动 + 验证
```

## 机制说明

- **配置状态判定**：host 端读取 `~/.dsh/settings.yaml`，判断 `llm-pi-ai.providers.zai` 是否存在，作为权威来源；浏览器端每 5 秒轮询一次 `GET /status`。
- **一键配置**：`POST /configure` 写入 `ZAI_API_KEY` 凭据与 `llm-pi-ai.providers.zai` 配置段，并把默认模型切换到智谱 `glm-4.7-flash`。
- **一键卸载**：`POST /uninstall` 清除 zai 配置段与凭据，默认模型切回 DeepSeek 官方 `deepseek-official / deepseek-v4-flash`。
- **设置页签**：通过 `settings.section` 插槽注入（官方插件同款机制），id 为 `dsh-0-tools`，页签名「零号工具」。
- **帮助中心**：拉取 `https://ai-yukin.github.io/dsh-0-tools/help.json` 并比对版本，失败时回退内置数据，文案更新无需重装插件。

## 免责声明

- 本插件为**第三方社区插件**，与 DeepSeek、智谱、OpenRouter（Ox-Alpha 模型所在平台）官方无任何关联，官方不对其提供支持。
- 使用本插件接入第三方模型服务，请自行遵守对应平台的服务条款与费用政策。
- 本项目按 MIT 许可证开源，使用者需自行承担使用风险。

## 许可证

[MIT](LICENSE) © 2026 ai-yukin

---

# dsh-0-tools No.0 Tools

## What Is No.0 Tools

No.0 Tools is designed for users with no programming background who are trying DeepSeek Harness (DSH) for the first time. It offers "Zero Threshold, Zero Cost, Zero Loss of Control" and aims to give zero-baseline users a better experience.

## Key Features

1. **Zero Threshold** — One-click installation of DSH and this tool.
2. **Zero Cost** — One-click configuration of free API models for DSH (currently Zhipu GLM and OpenRouter Ox-Alpha).
3. **Zero Loss of Control** — When calling the DeepSeek model API, the DSH UI shows real-time pricing (full price or half price).
4. **Zero Threshold** — A help center with curated, trustworthy sources to help beginners master DSH faster.

## Version & Compatibility

- Current version: **v1.3.2**
- Compatible DSH versions: `0.1.0-rc.7` – `0.1.1-rc.2`
- **System requirements**: Windows 10 / Windows 11 only. macOS and Linux are not supported at this time.

## Installation & Usage

### Step 1: Double-click install.bat

- If **DSH is already installed**: the script detects it and skips installation, then installs this tool directly.
- If **DSH is not installed**: the script scans the environment, installs any missing prerequisites, then installs DSH automatically.
- After a successful install, a **"DeepSeek Harness" desktop shortcut** is created automatically.

> Note: install.bat is a plain-text script — right-click it and choose "Open with → Notepad" to review its full content before running. Scripts downloaded from the internet are unsigned, so Windows may show a SmartScreen warning ("Windows protected your PC"); click "More info → Run anyway". This is a standard Windows prompt for unsigned scripts, not a virus warning.

### Step 2: Open the DSH interface

Double-click the "DeepSeek Harness" desktop shortcut. The browser opens the DSH web UI, where you'll see the "Click Here to Configure Free API Models" button at the bottom left.

![DSH main UI](screenshots/1.png)

### Step 3: Enter the Zero-Cost API Config Center

Click the button to open the **Zero-Cost API Config Center**, which lists the free models currently available.

![Zero-Cost API Config Center](screenshots/2.png)

### Step 4: Apply for and fill in your API Key

Follow the guide in the Zero-Cost API Config Center to register on the corresponding platform and obtain a free model API Key. Fill it in and enable it. You can install one or more free models.

![Model picker dropdown](screenshots/3.png)

### Step 5: Switch to a free model and use DSH at zero cost

Once configured, return to the DSH UI and select your free model in the model picker to start using DSH for free.

### Step 6: Use the paid DeepSeek model

If you decide to go paid and have already applied for a DeepSeek model API, click "Settings" at the bottom left of the DSH UI, find "Models", click "Edit" on DeepSeek, and enter your DeepSeek API key.

### Step 7: DeepSeek pricing reminder

When you switch to a DeepSeek model in the DSH UI, a real-time reminder appears at the bottom left. Based on DeepSeek's official API peak/off-peak schedule, it shows either "API is charged at full price during peak hours" or "API is charged at half price during off-peak hours", providing "Zero Loss of Control" fee protection.

![Peak hours: full price](screenshots/4.png)

![Off-peak hours: half price](screenshots/5.png)

## Domestic Mirror (Gitee)

A Gitee mirror is provided for users in mainland China:

- **Gitee mirror**: `https://gitee.com/ai-yukin/dsh-0-tools` (coming soon)

Notes:

- This repository uses **GitHub as the primary source** (`https://github.com/ai-yukin/dsh-0-tools`); Gitee is an auto-synced mirror kept consistent with the primary repository.
- The mirror is still under preparation and will go live as soon as the primary repository is updated. Stay tuned.
- For issues or suggestions, please file them in the Issues section of the GitHub primary repository.

## Compatibility

This plugin is developed and verified against the following DSH versions:

| DSH Version | Status |
|------|------|
| `0.1.0-rc.7` | Development baseline (peerDependency `^0.1.0-rc.7`) |
| `0.1.1-rc.2` | Tested & verified (page load / pricing bar / model picker / settings tab) |

> Before installing, make sure your DSH version is within `0.1.0-rc.7` – `0.1.1-rc.2` (check the latest version with `npm view @deepseek-ai/dsh versions`). If DSH releases a new major version (e.g., `0.2.x`), check this plugin's Release notes for compatibility before upgrading.

## Project Structure

```
dsh-0-tools/
├── lib/
│   ├── index.js     # host side: loopback service on 127.0.0.1:3090~3099 (/status /configure /uninstall)
│   └── client.js    # browser side: bottom-left toolbar + "No.0 Tools" settings tab
├── cordis.patch.yml # web profile injection declaration
├── package.json
├── help.json        # online data source for the help center (hosted on GitHub Pages)
└── install.bat      # one-click install + launch + verify
```

## How It Works

- **Config status detection**: The host side reads `~/.dsh/settings.yaml` and checks whether `llm-pi-ai.providers.zai` exists, using it as the source of truth; the browser side polls `GET /status` every 5 seconds.
- **One-click config**: `POST /configure` writes the `ZAI_API_KEY` credential and the `llm-pi-ai.providers.zai` provider block, and switches the default model to Zhipu `glm-4.7-flash`.
- **One-click uninstall**: `POST /uninstall` removes the zai provider block and credential, and switches the default model back to DeepSeek official `deepseek-official / deepseek-v4-flash`.
- **Settings tab**: Injected via the `settings.section` slot (the same mechanism official plugins use), id `dsh-0-tools`, tab name "No.0 Tools".
- **Help center**: Fetches `https://ai-yukin.github.io/dsh-0-tools/help.json` and compares versions; falls back to bundled data on failure, so content updates don't require reinstalling the plugin.

## Disclaimer

- This plugin is a **third-party community plugin**, not affiliated with DeepSeek, Zhipu AI, or OpenRouter (the platform hosting the Ox-Alpha model); the official vendors do not provide support for it.
- When using this plugin to connect to third-party model services, please comply with the respective platform's terms of service and pricing policies.
- This project is open-sourced under the MIT License. Users assume all risk of usage.

## License

[MIT](LICENSE) © 2026 ai-yukin
