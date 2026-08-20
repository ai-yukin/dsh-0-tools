---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d8ac214b9331b89602718b880fbbc556_985f344c9c7f11f19046525400287e28
    ReservedCode1: NyHe7HeP7veKE9JC0KF+OdwdtQ++tL1OxYA5iRIWL3LZ7ny0dv6givDAgnmYv9B1oBYqQPh90zShYrQM0jdWjRXNc3/fWTvaxG9CFKM2m1S19oddaSw80VQ2pP/GXdiAgCAgLJvWAeoyyCJBLVOqDBfKqF/MEK8rdaLKTN5ry7RTnmMRaZGqM/5RW08=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d8ac214b9331b89602718b880fbbc556_985f344c9c7f11f19046525400287e28
    ReservedCode2: NyHe7HeP7veKE9JC0KF+OdwdtQ++tL1OxYA5iRIWL3LZ7ny0dv6givDAgnmYv9B1oBYqQPh90zShYrQM0jdWjRXNc3/fWTvaxG9CFKM2m1S19oddaSw80VQ2pP/GXdiAgCAgLJvWAeoyyCJBLVOqDBfKqF/MEK8rdaLKTN5ry7RTnmMRaZGqM/5RW08=
---



# dsh-0-tools 零号工具 / Zero Tools

**DeepSeek Harness 小白零门槛零费用套件 · A beginner-friendly, zero-cost toolkit for DeepSeek Harness (DSH)**

> 面向完全不懂 API / YAML / 环境变量的新手：**双击、粘贴、直接用**。
> For users who know nothing about API / YAML / env vars: double-click, paste, and go.

当前版本 Current version: **v1.3.0** · 依赖基线 Base: DSH `0.1.0-rc.7`

## 功能一览 Features

| 位置 Position | 内容 Content | 说明 Description |
|------|------|------|
| 左下角（未配置时） | 蓝色按钮「点此处配置API免费模型」 | 一键接入智谱双免费模型（文本 + 图片） |
| 左下角（选中 DeepSeek 系列大模型时） | 高峰 / 空闲计价提醒条 | 实时提示当前 DeepSeek 计费时段是API原价的高峰时段，还是API半价的空闲时段 |
| 左下角（常驻） | 「帮助」 | 包括「零门槛·小白帮助中心」的官方资料、精选资料等内容，在线更新、离线兜底 |
| 设置弹窗 | 「零号工具」页签 | ① 零门槛·小白帮助中心、② 零费用·API配置中心、③ 零失控·费用管控中心 |

## 截图 Screenshots

> 截图将在正式发布前补充（见 CONTRIBUTING.md / GitHub Release）。

## 安装 Install

### 方法一：一键安装（推荐，Windows）

1. 把本项目**下载并解压**到一个文件夹（路径最好全英文，如 `D:\\dsh-0-tools`）。
2. 双击文件夹里的 **`install.bat`**。
3. 脚本会自动安装插件、启动 DSH，并自动打开网页 `http://127.0.0.1:3080`。
4. 看到左下角出现「帮助」和按钮，就安装成功了。

### 方法二：命令行安装

1. 在开始菜单搜索「PowerShell」并打开。
2. 逐行输入以下命令，每行输完按回车：

```bash
git clone https://github.com/ai-yukin/dsh-0-tools.git
cd dsh-0-tools
dsh plugin --profile web add "%cd%"
```

3. 完成后**重启 dsh web** 生效。

## 目录结构 Structure

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

## 机制说明 How it works

- **配置状态判定**：host 端读 `~/.dsh/settings.yaml` 判断 `llm-pi-ai.providers.zai` 是否存在，作为权威来源；浏览器端每 5 秒轮询 `GET /status`。
- **一键配置**：`POST /configure` 写入 `ZAI_API_KEY` 凭据、`llm-pi-ai.providers.zai` provider 段，并把默认模型切到智谱 `glm-4.7-flash`。
- **一键卸载**：`POST /uninstall` 清除 zai provider 段与凭据，默认模型切回 DeepSeek 官方 `deepseek-official / deepseek-v4-flash`。
- **设置页签**：通过 `settings.section` slot 注入（官方插件同款机制），id `dsh-0-tools`，页签名「零号工具」。
- **帮助中心**：拉取 `https://ai-yukin.github.io/dsh-0-tools/help.json` 并比对版本，失败时回退内置数据，文案更新无需重装插件。

## 免责声明 Disclaimer

- 本插件为**第三方社区插件**，与 DeepSeek / 智谱官方无任何关联，官方不对其提供支持。
- 使用本插件接入第三方模型服务，请自行遵守对应平台的服务条款与费用政策。
- 本项目按 MIT 许可证开源，使用者需自行承担使用风险。
- 部分仓库内容（含本 README）由 AI 辅助生成，仅供参考。

## 许可证 License

[MIT](LICENSE) © 2026 ai-yukin
*（内容由AI生成，仅供参考）*
