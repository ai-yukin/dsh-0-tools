# Gitee Release v1.8.5（删除前存档）

- 原仓库：https://gitee.com/ai-yukin/dsh-0-tools
- Release id：1121654
- 创建时间：2026-09-03T21:44:56+08:00
- 状态：published_at = None（**从未发布**）
- 删除时间：2026-10-08
- 删除原因：从未发布；且所谓『资产』只是 Gitee 自动生成的 tag 快照（archive/refs/tags/v1.8.5.zip 与 .tar.gz），无安装价值。
- tag v1.8.5 **保留未动**（与 GitHub 端 tag 保持一致）

--- 原 release notes ---

## v1.8.5 更新内容

### 主要优化
- 测速阈值调整：正常<8秒（原<3秒），较慢8-15秒（原3-8秒），适配国内免费模型
- 状态指示器样式修复：div改回button，恢复右半边圆弧
- 三色球位置调整：移到模型名后面（如"智谱🟢正常"）
- 修复 AUTO_SWITCH_THRESHOLD 未定义 bug
- 讯飞模型 ID 修复：spark-lite → lite

### 文档更新
- README 中文版更新（删除版本历史，精简内容）
- README 英文版翻译完成（v1.8.5 同步）
- 截图更新（去掉百度模型）

### 免费模型
智谱 / 硅基流动 / 讯飞星火 / OpenRouter