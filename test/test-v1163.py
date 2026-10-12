#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.16.3 回归测试：讯飞「已下线提醒」红框的消失判据。

用户报告的 bug：换完讯飞新 API Key 后，红框「已下线提醒·套餐处理」依旧醒目地
挂着，让人误以为没换成功（实际已换成功）。

修复思路：显示条件从「有没有配讯飞」改成「配的是不是已下线的老 model id」。
配置里已是新 model id → 红框撤掉，换成一行绿字。

这里测的是**判定逻辑本身**，把 RetiredResidueZone 里的 isPending 表达式原样
搬过来跑，而不是从源码里正则抠——抠出来的东西测不到分支真实行为。
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT = io.open(os.path.join(ROOT, "lib", "client.js"), encoding="utf-8").read()
HELP = json.load(io.open(os.path.join(ROOT, "help.json"), encoding="utf-8"))

PASS = 0
FAIL = 0


def check(name, cond, expect=True):
    global PASS, FAIL
    ok = bool(cond) == expect
    if ok:
        PASS += 1
    else:
        FAIL += 1
        print("  FAIL  %s  (expect=%s actual=%s)" % (name, expect, bool(cond)))
    return ok


def is_pending(stale, current):
    """与 client.js:RetiredResidueZone 中完全一致的判定式。

    stale    —— retiredModelIds（已下线的老 id 清单）；None 表示远程没给这个字段
    current  —— settings 里该 provider 实际配置的 model id 数组；None 表示读不到

    语义：读不到任一侧 → 维持旧行为继续提醒（宁可多提醒一次，
    也不让该处理的没处理）；两侧都读到 → 实际仍含老 id 才算「仍需处理」。
    """
    if stale is None or current is None:
        return True
    return any(i in stale for i in current)


retired_xh = None
for r in HELP.get("retired", []):
    if r.get("type") == "xinghuo":
        retired_xh = r
        break

print("=== v1.16.3 讯飞红框消失判据 ===")

# ---------- 0. 前置：讯飞条目必须带新字段 ----------
check("help.json 讯飞条目存在", retired_xh is not None)
if retired_xh is None:
    print("  致命：help.json 里没有 xinghuo 的 retired 条目，后续用例无法执行")
    print("\n通过 %d / 失败 %d" % (PASS, FAIL))
    sys.exit(1)

stale = retired_xh.get("retiredModelIds")
check("help.json 讯飞带 retiredModelIds", isinstance(stale, list) and len(stale) > 0)
check("retiredModelIds 含历史 id 'lite'", "lite" in (stale or []))
check("retiredModelIds 含历史 id 'spark-lite'", "spark-lite" in (stale or []))
check("help.json 讯飞带 doneText", bool(retired_xh.get("doneText")))
check("doneText 用词是「已经完成更新」", "已经完成更新" in (retired_xh.get("doneText") or ""))

# ---------- 1. 用户换完新 Key：配置里是新 model id → 红框必须消失 ----------
NEW = ["spark-x2.5-1.7b"]
check("★ 换新Key后（配的是新模型）红框消失",
      is_pending(stale, NEW) is False,
      expect=True)

# ---------- 2. 老用户还没换：仍是老 model id → 红框必须保留 ----------
for old in ("lite", "spark-lite"):
    check("★ 未换（配的是老模型 %s）红框保留" % old,
          is_pending(stale, [old]) is True)

# ---------- 3. 读不到配置 → 不冒充知道，维持提醒 ----------
check("★ modelIds 读不到(null) 时维持提醒，不误撤", is_pending(stale, None) is True)
check("★ retiredModelIds 缺失时退回旧逻辑，维持提醒", is_pending(None, NEW) is True)

# ---------- 4. 真实链路：换 Key 会重写 models 数组 ----------
# doAutoInstall 把 providerValue.models 设为 help.json 里的当前模型 id，
# 所以「粘贴新 Key + 一键安装」之后 settings 里必然只剩新 id。
free_xh = None
for m in HELP.get("freeModels", []):
    if m.get("type") == "xinghuo":
        free_xh = m
        break
check("help.json 讯飞 freeModels 存在", free_xh is not None)
if free_xh:
    new_ids = [x.get("id") for x in free_xh.get("models", [])]
    check("当前讯飞模型 id 是 spark-x2.5-1.7b", "spark-x2.5-1.7b" in new_ids)
    # 一键安装后 settings 里就是这个数组 → 判定必须为「已完成」
    check("★ 走完一键安装(写入当前models)后红框消失",
          is_pending(stale, new_ids) is False)

# ---------- 5. 代码接线：modelIds 真的传到了 RetiredResidueZone ----------
check("client.js 新增 readProviderModelIds", "function readProviderModelIds(" in CLIENT)
check("readProviderModelIds 读 llm-pi-ai providers.models[].id",
      'n.ns === "llm-pi-ai"' in CLIENT and "providers[k].models" in CLIENT)
check("useConfigured 返回 modelIds", "return { status, modelIds, loaded, hasAnyInstalled, refresh };" in CLIENT)
check("FreeConfigCenter 接收 modelIds", "retired: retired, status: status, modelIds: modelIds, refresh: refresh" in CLIENT)
check("RetiredResidueZone 调用处传入 modelIds",
      'RetiredResidueZone, { retired: retired, status: status, modelIds: modelIds, refresh: refresh }' in CLIENT)
check("RetiredResidueZone 从 props 取 modelIds", "const { retired, status, modelIds, refresh" in CLIENT)

# ---------- 6. 绿字只提示一次 ----------
check("用 ref 记住已播报（只提示一次）", "announcedRef = _react.useRef" in CLIENT)
check("已播报后置true 不再重复", "announcedRef.current[r.type] = true" in CLIENT)

# ---------- 7. 远程安检放行新字段（否则热更时字段被丢弃，功能等于没做） ----------
check("remoteFilterRetired 放行 retiredModelIds", "out.retiredModelIds = ids" in CLIENT)
check("remoteFilterRetired 放行 doneText", "out.doneText = r.doneText" in CLIENT)
check("retiredModelIds 有条数与长度上限（防注入）",
      "r.retiredModelIds.filter" in CLIENT and "slice(0, 20)" in CLIENT)

# ---------- 8. 内置兜底也必须带新字段（远程拉不到时不能整条消失） ----------
check("内置 DEFAULT_HELP 也补了讯飞条目",
      'type: "xinghuo",\n\t\t\t\t\ttitle: "讯飞星火"' in CLIENT or
      'type: "xinghuo"' in CLIENT.split("const DEFAULT_HELP")[1].split("const DEFAULT_HELP")[0] if False else
      ('type: "xinghuo"' in CLIENT[CLIENT.index("const DEFAULT_HELP"):CLIENT.index("const DEFAULT_HELP")+9000]))
check("内置讯飞也带 retiredModelIds",
      'retiredModelIds: ["lite", "spark-lite"]' in CLIENT)

print("\n通过 %d / 失败 %d" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)