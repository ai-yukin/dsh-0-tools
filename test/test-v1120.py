# -*- coding: utf-8 -*-
"""v1.12.0 新增逻辑的回归测试（纯函数级，不启服务、不占端口）。

覆盖三组：
  1. semver 比较与版本判定（parseSemver / compareSemver 的等价实现）
  2. 测速历史持久化的序列化与恢复规则（TTL / 逐字段校验 / 状态不恢复）
  3. help.json 的 plugin 段落安检过滤规则

做法：把 client.js 里的纯函数**等价重写**一份，逐条喂边界值。
不 import真实模块——它是 UMD 打包产物，且顶层依赖 DSH 运行时注入的 react，
在 Node 里 require 会失败。重写的逻辑必须与源码逐行对照，改源码时同步改这里。
"""
import json
import re
import sys
import time

SRC = "lib/client.js"
HELP = "help.json"

passed = 0
failed = []


def check(name, got, want):
    global passed
    if got == want:
        passed += 1
    else:
        failed.append("%s\n    实得 %r\n    应为 %r" % (name, got, want))


# ---------- 与 client.js 逐行等价的实现 ----------

def parse_semver(v):
    if not isinstance(v, str):
        return None
    m = re.match(r"^v?(\d+)\.(\d+)(?:\.(\d+))?(?:[-+].*)?$", v.strip())
    if not m:
        return None
    return (int(m.group(1)), int(m.group(2)), 0 if m.group(3) is None else int(m.group(3)))


def compare_semver(a, b):
    pa, pb = parse_semver(a), parse_semver(b)
    if not pa or not pb:
        return 0
    for i in range(3):
        if pa[i] != pb[i]:
            return 1 if pa[i] > pb[i] else -1
    return 0


def remote_safe_url(u):
    """对应 client.js 的 remoteIsSafeUrl：https 强制 + 长度上限。"""
    if not isinstance(u, str):
        return False
    u = u.strip()
    return len(u) <= 300 and u.startswith("https://")


def remote_safe_text(v, mx):
    """对应 remoteSafeText：拒换行/制表/尖括号并限长。"""
    if not isinstance(v, str) or not v.strip():
        return False
    if len(v) > mx:
        return False
    return not any(ch in v for ch in ("\n", "\r", "\t", "<", ">"))


def remote_filter_plugin_meta(p):
    """对应 client.js 的 remoteFilterPluginMeta：任一字段非法 → 整体丢弃该字段。"""
    if not isinstance(p, dict) or isinstance(p, list):
        return None
    out = {}
    if "latestVersion" in p:
        v = p["latestVersion"]
        if not isinstance(v, str) or len(v) > 32:
            return None
        if not re.match(r"^v?\d+\.\d+(\.\d+)?([-+].*)?$", v.strip()):
            return None
        out["latestVersion"] = v.strip()
    if "releaseUrl" in p:
        if not remote_safe_url(p["releaseUrl"]):
            return None
        out["releaseUrl"] = p["releaseUrl"]
    if "notes" in p:
        if not remote_safe_text(p["notes"], 200):
            return None
        out["notes"] = p["notes"]
    return out if out else None


# ---------- 1. semver 比较 ----------

check("同版本 → 0", compare_semver("1.12.0", "1.12.0"), 0)
check("补丁位更高 → 1", compare_semver("1.12.1", "1.12.0"), 1)
check("补丁位更低 → -1", compare_semver("1.12.0", "1.12.1"), -1)
check("次版本更高 → 1（不能当字典序比）", compare_semver("1.9.0", "1.10.0"), -1)
check("主版本更高 → 1", compare_semver("2.0.0", "1.99.99"), 1)
check("两段式当作 .0", compare_semver("1.12", "1.12.0"), 0)
check("带 v 前缀", compare_semver("v1.13.0", "1.12.0"), 1)
check("预发布后缀可比", compare_semver("1.12.0-rc.1", "1.12.0"), 0)
check("非法输入按 0（宁可不提示也不误报）", compare_semver("abc", "1.0.0"), 0)
check("空字符串按 0", compare_semver("", "1.0.0"), 0)
check("None 按 0", compare_semver(None, "1.0.0"), 0)
check("非字符串按 0", compare_semver(123, "1.0.0"), 0)

# ---------- 2. plugin 段落安检 ----------

check("合法 plugin 全放行",
      remote_filter_plugin_meta({"latestVersion": "1.12.0", "releaseUrl": "https://github.com/a/b/releases/latest", "notes": "新增提示"}),
      {"latestVersion": "1.12.0", "releaseUrl": "https://github.com/a/b/releases/latest", "notes": "新增提示"})

check("缺 plugin → None（不提示）", remote_filter_plugin_meta(None), None)
check("空对象 → None", remote_filter_plugin_meta({}), None)
check("数组→ None", remote_filter_plugin_meta([1, 2]), None)
check("http 链接必须拒（防降级到明文）",
      remote_filter_plugin_meta({"latestVersion": "1.12.0", "releaseUrl": "http://evil.example/x"}), None)
check("javascript: 必须拒",
      remote_filter_plugin_meta({"releaseUrl": "javascript:alert(1)"}), None)
check("非 semver 的 latestVersion → 整体丢弃",
      remote_filter_plugin_meta({"latestVersion": "<script>alert(1)</script>"}), None)
check("超长 latestVersion → 丢弃",
      remote_filter_plugin_meta({"latestVersion": "1.12." + "0" * 40}), None)
check("notes 含换行 → 丢弃", remote_filter_plugin_meta({"notes": "a\nb"}), None)
check("notes 含尖括号 → 丢弃", remote_filter_plugin_meta({"notes": "<b>x</b>"}), None)
check("notes 超 200 字 → 丢弃", remote_filter_plugin_meta({"notes": "x" * 201}), None)
check("notes 恰好 200 字 → 放行", bool(remote_filter_plugin_meta({"notes": "x" * 200})), True)
check("非字符串 latestVersion → 丢弃",
      remote_filter_plugin_meta({"latestVersion": 112}), None)

# ---------- 3. 测速历史：序列化与恢复 ----------

HEALTH_HISTORY_SIZE = 5
HEALTH_STORE_TTL = 24 * 60 * 60 * 1000
HEALTH_STORE_MAX_PROVIDERS = 16


def serialize(state):
    """对应 serializeHealthState：只留数值与枚举，不留错误正文。"""
    providers = {}
    n = 0
    for k in state:
        if n >= HEALTH_STORE_MAX_PROVIDERS:
            break
        s = state[k]
        lat = [x for x in s["latencies"]
               if isinstance(x, (int, float)) and not isinstance(x, bool)
               and 0 < x < 600000][-HEALTH_HISTORY_SIZE:]
        providers[k] = {
            "latencies": lat,
            "lastChecked": s.get("lastChecked") if isinstance(s.get("lastChecked"), int) else 0,
            "status": s.get("status") if s.get("status") in ("ok", "slow", "unavailable", "unknown") else "unknown",
        }
        n += 1
    return {"savedAt": int(time.time() * 1000), "providers": providers}


def restore(blob, now_ms):
    """对应 restoreHealthState：TTL、白名单、逐字段校验、status 不恢复。"""
    if not isinstance(blob, dict):
        return {}
    saved = blob.get("savedAt")
    if not isinstance(saved, int) or isinstance(saved, bool):
        return {}
    if now_ms - saved > HEALTH_STORE_TTL:
        return {}          # 过期 → 整份丢弃
    providers = blob.get("providers")
    if not isinstance(providers, dict) or isinstance(providers, list):
        return {}
    if len(providers) > HEALTH_STORE_MAX_PROVIDERS:
        return {}
    out = {}
    for k, e in providers.items():
        if not re.match(r"^[a-z][a-z0-9-]{0,31}$", k):
            continue
        if not isinstance(e, dict):
            continue
        lat = [x for x in (e.get("latencies") or [])
               if isinstance(x, (int, float)) and not isinstance(x, bool)
               and 0 < x < 600000][-HEALTH_HISTORY_SIZE:]
        if not lat:
            continue
        out[k] = {
            "latencies": lat,
            # 状态一律回到 unknown——上次的结论隔天未必成立
            "status": "unknown",
            "consecutiveUnavailable": 0,
            "lastErrorType": None,
        }
    return out


st = {
    "zai": {"latencies": [1000, 2000, 1500, 1200, 1800, 9999], "lastChecked": 1, "status": "ok",
            "lastErrorBody": "含上游返回的任意文本，不该落盘"},
}
ser = serialize(st)
# slice(-5) 丢的是**最旧**那个（第 1 个 1000），9999 是最新的第 6 个，应当保留
check("只保留最近 5 个样本", len(ser["providers"]["zai"]["latencies"]), 5)
check("截掉最旧的样本（1000）", ser["providers"]["zai"]["latencies"][0] == 1000, False)
check("最新的样本必须保留（9999）", ser["providers"]["zai"]["latencies"][-1], 9999)
check("错误正文不落盘", "lastErrorBody" in ser["providers"]["zai"], False)
check("落盘结构只有三个键", sorted(ser["providers"]["zai"].keys()), ["lastChecked", "latencies", "status"])

now = int(time.time() * 1000)
r = restore(ser, now)
check("恢复出 provider", list(r.keys()), ["zai"])
check("恢复后 status 必须是 unknown（不信任旧结论）", r["zai"]["status"], "unknown")
check("恢复后连续失败计数归零", r["zai"]["consecutiveUnavailable"], 0)
check("恢复后不携带错误类型", r["zai"]["lastErrorType"], None)

check("TTL 未过期 → 恢复成功", len(restore(ser, now)), 1)
check("TTL 刚过期 → 整份丢弃", restore(ser, now + HEALTH_STORE_TTL + 1), {})

# 篡改样本
check("盘上 latencies 被塞字符串 → 拒绝该键",
      restore({"savedAt": now, "providers": {"zai": {"latencies": ["9999"]}}}, now), {})
check("盘上 latencies 含 0 → 滤掉", restore({"savedAt": now, "providers": {"zai": {"latencies": [0, 1200]}}}, now)["zai"]["latencies"], [1200])
check("盘上 latencies 含负数 → 滤掉", restore({"savedAt": now, "providers": {"zai": {"latencies": [-5, 1200]}}}, now)["zai"]["latencies"], [1200])
check("盘上写死 medianLatency 不被采信",
      "medianLatency" in restore({"savedAt": now, "providers": {"zai": {"latencies": [1200], "medianLatency": 1}}}, now)["zai"], False)
check("providerKey 不合法 → 跳过",
      restore({"savedAt": now, "providers": {"../etc/passwd": {"latencies": [1200]}}}, now), {})
check("providerKey 超长 → 跳过",
      restore({"savedAt": now, "providers": {"a" * 40: {"latencies": [1200]}}}, now), {})
check("provider 数超上限 → 整份丢弃",
      restore({"savedAt": now, "providers": {("p%d" % i): {"latencies": [100]} for i in range(20)}}, now), {})
check("savedAt 不是整数 → 丢弃", restore({"savedAt": "x", "providers": {}}, now), {})
check("providers 是数组 → 丢弃",
      restore({"savedAt": now, "providers": []}, now), {})
check("整体不是对象 → 丢弃", restore("x", now), {})
check("空 latencies → 跳过该键",
      restore({"savedAt": now, "providers": {"zai": {"latencies": []}}}, now), {})

# ---------- 4. help.json 自身合规 ----------

with open(HELP, "r", encoding="utf-8") as f:
    help_raw = f.read()
hj = json.loads(help_raw)

check("help.json 有 plugin 段", isinstance(hj.get("plugin"), dict), True)
filtered = remote_filter_plugin_meta(hj.get("plugin"))
check("help.json 的 plugin 能通过自家安检", filtered is not None, True)
check("help.json latestVersion 是 semver", parse_semver(hj["plugin"]["latestVersion"]) is not None, True)
check("help.json releaseUrl 是 https", hj["plugin"]["releaseUrl"].startswith("https://"), True)
check("help.json notes 不含换行", "\n" not in hj["plugin"]["notes"], True)
# 关键：仓库里的版本号必须等于通告的版本号，否则用户永远看不到更新提示
src = open(SRC, "r", encoding="utf-8").read()
m = re.search(r'const PLUGIN_VERSION = "([^"]+)"', src)
check("PLUGIN_VERSION 可解析", m is not None, True)
plugin_version = m.group(1)
check("help.json 通告版本 == 代码版本（否则提示永远不触发）",
      hj["plugin"]["latestVersion"], plugin_version)

# ---------- 汇总 ----------
print("通过 %d 项" % passed)
if failed:
    print("失败 %d 项：" % len(failed))
    for f_ in failed:
        print("  ✗ " + f_)
    sys.exit(1)
print("全部通过")