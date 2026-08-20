---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d8ac214b9331b89602718b880fbbc556_9918f29f9c7f11f184de525400f8a581
    ReservedCode1: kb65I4y9uBwA808eX0ETr4eVb4oh1mUrS7HZsQbV/1vCZK6Bq6GB7VHsW5LmL7UwDbdXWezKv/Y515SPHTYkTHbKpO7dXTLYWyblkVbdUgGabo6OUOa/ay3i6QUqqThTnlw2qf0gJQCCV3ixII1ZLmdSr8qweHPyq+z3h/UUSY7IT2vJRkmw3CAtyOM=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d8ac214b9331b89602718b880fbbc556_9918f29f9c7f11f184de525400f8a581
    ReservedCode2: kb65I4y9uBwA808eX0ETr4eVb4oh1mUrS7HZsQbV/1vCZK6Bq6GB7VHsW5LmL7UwDbdXWezKv/Y515SPHTYkTHbKpO7dXTLYWyblkVbdUgGabo6OUOa/ay3i6QUqqThTnlw2qf0gJQCCV3ixII1ZLmdSr8qweHPyq+z3h/UUSY7IT2vJRkmw3CAtyOM=
---

# 贡献指南 Contributing

感谢你愿意参与 **dsh-0-tools** 的开发。请先阅读本文件与 README，了解项目定位与维护约定，再开始改动。

## 行为准则

- dsh-0-tools 零号工具的目标是保持对小白「零门槛+零费用+零失控」的定位；只改插件不改 DSH 本体；UI 配色克制、设计简洁大方。

## 如何报告问题 Bug Reports

1. 到 [Issues](https://github.com/ai-yukin/dsh-0-tools/issues) 新建 issue。
2. 描述：DSH 版本、dsh-0-tools 版本、复现步骤、期望行为、实际行为。
3. 若与日志相关，附上控制台 / host 端错误信息。

## 如何提交代码 Pull Requests

1. Fork 本仓库并创建特性分支：`git checkout -b feat/xxx` 或 `fix/xxx`。
2. 本地验证：运行 `install.bat` 或手动 `dsh plugin --profile web add <路径>` 安装后启动 DSH，确认无回归。
3. 提交信息建议使用 Conventional Commits 风格：`feat:` / `fix:` / `docs:` / `chore:`。
4. 发起 PR，说明改动内容与验证结果。

## 开发约定

- host 端逻辑在 `lib/index.js`，浏览器端 UI 在 `lib/client.js`。
- 帮助中心文案：同时更新 `help.json`（远程源）与内置 `DEFAULT_HELP`（client.js 内兜底），保持结构一致（`{version, updatedAt, official:[], selected:[]}`）。
- 每个功能改动完成后，请在本仓库外的本地维护记录中追加版本与改动说明（该记录不随仓库发布）。

## 版本与发布

- 版本号遵循 semver，发布目录：`发布/dsh-0-tools-vX.Y.Z/`。
- 正式发布前补齐 README 截图，并在 GitHub Release 中说明改动。
- 发布后记得执行帮助中心 JSON 托管（将 `help.json` 推送到 GitHub Pages 仓库 `ai-yukin/dsh-0-tools`，路径 `dsh-0-tools/help.json`）。
*（内容由AI生成，仅供参考）*
