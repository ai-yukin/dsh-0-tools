# dsh-0-tools 零号工具（No.0 Tools）

[简体中文](./README.md) · [English](./README.en.md)

## 零号工具是什么

零号工具是面向编程零基础的用户、初次使用 DeepSeek Harness（以下简称 DSH）场景而设计的工具，具有「零门槛、零费用、零失控」的特性，希望帮助零基础用户获得更好的使用体验。

## 主要功能

1. <strong>【零门槛】</strong>一键安装 DSH 及本工具；
2. <strong>【零费用】</strong>一键为 DSH 安装配置可免费调用 API 的大模型（v1.6.0 起：智谱 GLM + OpenRouter 免费模型池）；
3. <strong>【零失控】</strong>若选择调用 DeepSeek 模型 API，将在 DSH 的界面实时提示 API 费用是原价还是半价；
4. <strong>【零门槛】</strong>为了让新手更快学习掌握 DSH，在帮助中心提供了靠谱信源的相关资讯。

> **v1.6.0 新增**：配置中心新增「OpenRouter 免费模型池」卡片——粘贴一个 OpenRouter API Key（免费注册，无需绑卡），即可接入 OpenRouter 官方免费模型路由器（`openrouter/free`）：每次请求自动从当前可用的免费模型池（约 27 款、动态更新）中挑选一款执行，某款下架自动绕开，随时都有免费模型可用。注意：免费通道的对话内容可能被模型厂商留存用于训练，请勿输入商业机密、个人隐私等敏感内容；免费档限速较低（零余额约每天 50 次请求，社区实测值）。

## 当前版本与兼容范围

- 当前版本：**v1.7.0**
- **v1.7.0 新增**：新增 macOS / Linux 一键安装脚本 `install.sh`，功能与 Windows 版 `install.bat` 完全对齐（自动装 Node.js / DSH、备份旧插件、安装插件、启动 DSH、打开浏览器、创建桌面快捷方式）。插件核心代码（lib/index.js + lib/client.js）本身为纯 JavaScript、平台无关，此前仅因缺少一键安装脚本而未正式支持 macOS/Linux。
- **v1.6.1 修复**：修复页脚「点此处配置API免费模型」提示条的显隐逻辑——旧版只检查智谱是否配置，导致仅接入 OpenRouter 免费模型池时提示条仍错误显示；改为检查是否有任一免费模型已接入（智谱 / OpenRouter / 未来新增模型均适用）。
- 兼容 DSH 版本：**≥ `0.1.1`**（v1.5.0 起改用 DSH 官方配置通道，最低兼容版本收缩，详见下方「兼容性」公告）
- **系统要求**：一键安装脚本支持 **Windows 10 / Windows 11**（`install.bat`）和 **macOS / Linux**（`install.sh`）；插件核心代码本身跨平台，已手动装好 DSH 的用户可通过 `dsh plugin --profile web add /path/to/dsh-0-tools` 手动安装。

## 安装与使用（图文步骤）

### 第 1 步：运行一键安装脚本

- **Windows 用户**：双击运行 install.bat
- **macOS / Linux 用户**：在终端中运行 chmod +x install.sh && ./install.sh

#### Windows 版（install.bat）

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

本仓库为中国大陆用户提供了 Gitee 镜像，现已开放：

- **Gitee 镜像**：`https://gitee.com/ai-yukin/dsh-0-tools`

说明：

- 本仓库以 **GitHub 为主源仓库**（`https://github.com/ai-yukin/dsh-0-tools`），Gitee 为国内镜像，内容与主仓库保持一致；
- 镜像由维护者手动同步维护，主仓库更新后稍晚会同步到镜像仓库；如需获取最新版本，请以 GitHub 主仓库为准；
- 如需反馈问题或建议，请在 GitHub 主仓库的 Issues 中提交。

## 兼容性

本插件针对以下 DSH 版本开发与验证：

| DSH 版本 | 状态 |
|------|------|
| `0.1.1-rc.2` | 已实测适配通过（页面加载 / 计价条 / 模型选择器 / 设置页签 / 官方配置通道） |

> **v1.5.0 兼容范围公告**：本版本改用 DSH 官方配置通道（`/api` 同址 RPC），依赖该通道提供的原子写入、输入校验与版本防冲突能力，因此**最低兼容版本收缩为 `0.1.1`**。此前声明的 `0.1.0-rc.7` 基线未经真实验证（旧版在 `0.1.0-rc.7` 上是否可用无法确认），不再承诺。若你的 DSH 低于 `0.1.1`，请先升级 DSH 再安装本插件（查看本机版本：`dsh --version`；查看最新版本：`npm view @deepseek-ai/dsh versions`）。DSH 发布新大版本（如 `0.2.x`）后，请先查看本插件 Release 说明确认适配，再决定是否升级。

## 目录结构

```
dsh-0-tools/
├── lib/
│   ├── index.js     # host 端：v1.5.0 起为 no-op 占位（配置读写已迁至浏览器端官方通道）
│   └── client.js    # 浏览器端：左下角工具条 + 设置页签「零号工具」+ 经官方 /api 读写配置
├── cordis.patch.yml # web profile 注入声明
├── package.json
├── help.json        # 帮助中心在线数据源（托管于 GitHub Pages）
├── install.bat      # Windows 一键安装 + 启动 + 验证
└── install.sh       # macOS / Linux 一键安装 + 启动 + 验证
```

## 机制说明

> **v1.5.0 架构变更**：早期版本（≤ v1.4.x）由 host 端开一个 `127.0.0.1:3090~3099` 本地服务、并用正则直接改写配置文件来持久化模型配置。该自建服务无来源校验（任何本机网页都能触发写操作，安全审计中已被实测利用），且正则裸写会与 DSH 自身的原子写并发冲突、静默丢失未知字段。v1.5.0 起全部改为调用 **DSH 官方同址配置通道**，上述安全与数据风险随之消除；host 端仅保留一个空占位。

- **配置状态判定**：浏览器端调用官方 `settings.describe` + `credentials.describe`，判断 `llm-pi-ai.providers.zai` 是否存在及其凭据是否已配置，作为权威来源；每 5 秒轮询一次刷新界面。
- **一键配置**：依次经官方 `credentials.set` 写入 `ZAI_API_KEY` 凭据、`settings.mutate` 写入 `llm-pi-ai.providers.zai` 配置段、`settings.update` 以合并语义把默认模型切换到智谱 `glm-4.7-flash`（合并语义确保 `reasoningEffort` 等用户已设字段不被抹掉）。
- **一键卸载**：经官方通道清除 zai 配置段与对应凭据；仅当默认模型此前指向 zai 时，恢复为配置前记录的原始默认模型，否则保持用户当前选择不变。
- **失效残留清理**：配置中心检测本地是否残留已下线/失效的模型 provider（动态读取其 `apiKeyEnv`，不再依赖本地静态清单），在界面给出「失效残留」提示并提供一键清理，避免孤儿配置无法删除。
- **设置页签**：通过 `settings.section` 插槽注入（官方插件同款机制），id 为 `dsh-0-tools`，页签名「零号工具」。
- **帮助中心**：拉取 `https://ai-yukin.github.io/dsh-0-tools/help.json`，经统一过滤器 `filterRemotePayload` 逐字段安检（URL 强制 https、文本拒绝控制字符/换行、模型 id 与凭据名走字符白名单）后再进入界面与配置链，失败或不合规时回退内置数据；可配置模型清单与已下线模型清单均由此远程数据驱动，新增或下线模型无需重装插件。

## 免责声明

- 本插件为**第三方社区插件**，与 DeepSeek、智谱官方均无任何关联，官方不对其提供支持。
- 使用本插件接入第三方模型服务，请自行遵守对应平台的服务条款与费用政策。
- 本项目按 MIT 许可证开源，使用者需自行承担使用风险。

## 许可证

[MIT](LICENSE) © 2026 ai-yukin
