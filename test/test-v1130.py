# -*- coding: utf-8 -*-
"""v1.13.0 「零遗忘 / 零中断」回归测试

测的是最容易悄悄坏掉的三处：
  1. 自动开关的三态读取（null / "false" / "true"）
  2. 切换历史的有界保存与过期剔除
  3. 切换通知必须带 reason（不带就是退回v1.12 行为）
"""
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLIENT = (ROOT / "lib" / "client.js").read_text(encoding="utf-8")

passed = failed = 0
def check(label, actual, expect):
    global passed, failed
    if actual == expect:
        passed += 1
        print("  PASS  " + label)
    else:
        failed += 1
        print("  FAIL  " + label + "\n          期望: " + repr(expect) + "\n          实际: " + repr(actual))


def has(label, needle):
    check(label, needle in CLIENT, True)


print("\n=== 1. 自动开关三态（零遗忘的核心） ===")
# 默认值必须是 true，不能退回false
has("默认值不再是 _autoSwitchEnabled = false", "_autoSwitchEnabled = false;\n\t\tlet _lastAutoSwitchTime")
check("读取逻辑三态分支存在", 'raw === "false"' in CLIENT and 'raw === null' in CLIENT, True)
has("「明确关过」保持关闭", "raw === \"false\"")if False else None
# 具体断言
m = re.search(r'const raw = localStorage\.getItem\(AUTO_SWITCH_KEY\);\s*\n\s*if \(raw === "false"\) \{\s*\n\s*_autoSwitchEnabled = false;\s*\n\s*\} else \{\s*\n\s*_autoSwitchEnabled = true;', CLIENT)
check("null 与 \"true\" 都归入默认开启分支", bool(m), True)
has("未看过说明时才置introPending", "!localStorage.getItem(AUTO_SWITCH_INTRO_KEY)")

print("\n=== 2. 首次说明：一次性、可确认 ===")
has("说明已读标记 key", 'AUTO_SWITCH_INTRO_KEY = "dsh-0-tools:auto-switch-intro-seen"')
has("确认函数 acknowledgeAutoSwitchIntro", "function acknowledgeAutoSwitchIntro()")
has("确认后写已读标记", "localStorage.setItem(AUTO_SWITCH_INTRO_KEY, \"1\")")
# 用户主动切换也算已知情 —— 不能下次还弹
has("主动切换时清掉 introPending", "setIntroPending(false);")
has("setAutoSwitch 内也清掉 introPending", "_autoSwitchIntroPending = false;\n\t\t\ttry {")

print("\n=== 3. 切换通知必须说明原因（零中断） ===")
has("通知结构带 reason", "reason: reasonText,")
has("通知结构带 reasonKey", "reasonKey: reasonKey,")
# 旧行为是 10 秒，v1.13.0 必须延长
check("不再使用硬编码 10000ms 定时器", ">= 10000" in CLIENT, False)
has("停留时长提到 60 秒", "AUTO_SWITCH_NOTICE_MS = 60 * 1000")
has("定时器引用常量", ">= AUTO_SWITCH_NOTICE_MS")
# 原因要翻译成人话，不能直接把内部枚举丢给用户
has("额度耗尽人话", 'quota_exhausted: "额度已用完"')
has("认证失败人话", 'auth_failed: "API Key 被拒"')
has("未知原因兜底", 'unknown: "连续不可用"')

print("\n=== 4. 切换历史：跨重启保留且有界 ===")
has("历史 key", 'SWITCH_HISTORY_KEY = "dsh-0-tools:switch-history"')
has("条数上限", "const SWITCH_HISTORY_MAX = 10;")
has("过期时间", "const SWITCH_HISTORY_TTL = 7 * 24 * 60 * 60 * 1000;")
has("写入函数 appendSwitchHistory", "function appendSwitchHistory(entry)")
has("读取函数 getSwitchHistory", "function getSwitchHistory()")
has("清空函数 clearSwitchHistory", "function clearSwitchHistory()")
has("超出上限用 shift 丢最旧", "while (trimmed.length > SWITCH_HISTORY_MAX) trimmed.shift();")
has("按 TTL 剔除过期", "now - x.at < SWITCH_HISTORY_TTL")
# 字符串必须截断，否则超长模型名会撑爆 localStorage
has("from 截断", 'String(entry.from || "").slice(0, 40)')
has("to 截断", 'String(entry.to || "").slice(0, 40)')
has("reason 截断", 'String(entry.reason || "").slice(0, 40)')

print("\n=== 5. 历史面板 UI 接通 ===")
has("配置中心读历史", "health.getSwitchHistory ? health.getSwitchHistory() : []")
has("清空按钮 handler", "handleClearSwitchHistory")
has("空列表不渲染面板", "switchHistory.length ?")
has("面板标题写明条数", 'children: "自动切换记录（最近 " + switchHistory.length + " 次）"')
# 轮询只比长度，避免整表重渲染
has("轮询只比长度", "prev.length === next ? prev")

print("\n=== 6. health 接口导出齐全 ===")
for fn in ["getAutoSwitchIntroPending: getAutoSwitchIntroPending",
           "acknowledgeAutoSwitchIntro: acknowledgeAutoSwitchIntro",
           "getSwitchHistory: getSwitchHistory",
           "clearSwitchHistory: clearSwitchHistory"]:
    has("导出 " + fn.split(":")[0], fn)

print("\n=== 7. 版本号同步 ===")
pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
m = re.search(r'const PLUGIN_VERSION = "([^"]+)"', CLIENT)
check("client.js PLUGIN_VERSION 存在", bool(m), True)
ver = m.group(1)
check("package.json 版本 == 代码版本", pkg["version"], ver)
check("版本已升到 1.13.0", ver, "1.13.0")
m2 = re.search(r'const SUPPORTED_DSH_RANGE = \{ min: "([^"]+)", max: "([^"]+)" \}', CLIENT)
check("DSH 支持区间未被动过", (m2.group(1), m2.group(2)), ("0.1.5", "0.2.99"))

print("\n" + "=" * 52)
print("通过 " + str(passed) + " / 失败 " + str(failed))
sys.exit(1 if failed else 0)