#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.16.3 回归测试：帮助中心与「关于·About」合并。

用户判断：② 帮助中心 与 ④ 关于 两块内容定位重叠（都在回答「这工具是什么、
找谁、怎么反馈」），应合二为一。合并后卡片顺序：
    ① 零费用·免费模型管家中心
    ② 零失控·费用管控中心     （序号由③ 调整而来）
    ③ 零门槛·小白帮助中心     （序号由② 调整而来，内含原关于面板内容）

同时：
    ·「精选资料」标签改名「工具资料」
    · 工具资料内只留 GitHub 仓库 / 反馈问题，删掉外部收录站外链
    · 删掉「运行环境：DSH 版本」行（用户规划里没有，且与①兼容范围重复）
    · 导出/导入链接保留，并加一行用途说明
"""
import io
import json
import os
import re
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


print("=== v1.16.3 帮助中心与关于面板合并 ===")

# ---------- 1. 卡片序号与顺序 ----------
# 取出SettingsSection 里三张卡的标题，按出现顺序比对。
sec_start = CLIENT.index("function SettingsSection(")
sec_end = CLIENT.index("function FooterActions(")
sec = CLIENT[sec_start:sec_end]

# ⚠️ 标题里混用了两种写法：①是 \u2460 转义，②③是直接写的中文数字。
# ⚠️⚠️ 绝不能用 .encode('utf-8').decode('unicode_escape') 反转义 ——
# 它把UTF-8 字节当成 latin-1 逐字节解码，中文会全部变成乱码。
# 这里只把 \uXXXX 还原成字符，其余字节原样保留。
def unescape_js(s):
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)


titles = [unescape_js(m.group(1)) for m in
          re.finditer(r'CARD_TITLE, children: "([^"]*)"', sec)]

check("设置区只剩 3 张卡片（原 4 张）", len(titles) == 3, expect=True)
check("第 1 张是① 零费用·免费模型管家中心", titles[0] == "① 零费用·免费模型管家中心" if len(titles) > 0 else False)
check("★ 第 2 张是② 零失控·费用管控中心（原③）", titles[1] == "② 零失控·费用管控中心" if len(titles) > 1 else False)
check("★ 第 3 张是③ 零门槛·小白帮助中心（原②）", titles[2] == "③ 零门槛·小白帮助中心" if len(titles) > 2 else False)

# 原④ 卡片已删：设置区里不应再出现「关于·About」标题（注释里的提及不算）
check("★ 原④「关于·About」卡片已删除",
      'CARD_TITLE, children: "\\u2463' not in sec and "关于·About" not in
      re.sub(r'//.*', '', sec))
check("序号④ 不再出现在设置区标题里",
      not any(t.startswith("④") for t in titles))

# ---------- 2. 关于内容并入帮助中心 ----------
check("HelpContent 内挂 AboutBlock", "(AboutBlock, { data: data, source: source })" in CLIENT)
check("AboutBlock 组件已定义", "function AboutBlock(props)" in CLIENT)
check("AboutBlock 含项目名称", "项目名称：零号工具（dsh-0-tools）" in CLIENT)
check("AboutBlock 含作者", "作者：ai-yukin" in CLIENT)
check("AboutBlock 含开源许可证", "开源许可证：MIT" in CLIENT)
check("AboutBlock 版本号引用 PLUGIN_VERSION", 'children: "当前版本：v" + PLUGIN_VERSION' in CLIENT)

# ---------- 3. 按用户规划：删掉运行环境行 ----------
# ⚠️ 必须先剥掉注释再查。代码注释里明确写着「删掉「运行环境：DSH 版本」行」，
# 全文件 grep 会命中这行注释 → 误判成「没删」。这正是我第一版测试的错误。
code_only = re.sub(r"/\*.*?\*/", "", CLIENT, flags=re.S)
code_only = re.sub(r"//[^\n]*", "", code_only)
check("★ 已删除「运行环境：DSH」显示行", "运行环境：DSH " not in code_only)
check("随之移除 useDshVersion() 的调用（免得白打诊断接口）",
      "const dshVersion = useDshVersion();" not in code_only)

# ---------- 4. 精选资料 → 工具资料 ----------
check("★ 标签名已改为「工具资料」", 'children: "工具资料"' in CLIENT)
check("旧标签名「精选资料」不再是 UI 文案",
      'children: "精选资料"' not in CLIENT)
check("「官方资料」标签保留不动", 'children: "官方资料"' in CLIENT)

# ---------- 5. 工具资料内只剩两条 ----------
sel_titles = [x.get("title", "") for x in HELP.get("selected", [])]
sel_urls = [x.get("url", "") for x in HELP.get("selected", [])]
check("★ help.json selected 只剩 2 条", len(HELP.get("selected", [])) == 2, expect=True)
check("含 GitHub 仓库入口", any(u.rstrip("/") == "https://github.com/ai-yukin/dsh-0-tools" for u in sel_urls))
check("含 反馈问题 入口", any("issues/new" in u for u in sel_urls))
check("★ 已删除「DSH Plugin 广场」外链", "skillhub.cn" not in json.dumps(HELP, ensure_ascii=False))
check("★ 已删除「awesome 站」外链", "awesome-dsh-plugin.com" not in json.dumps(HELP, ensure_ascii=False))
check("官方资料三条保持不动", len(HELP.get("official", [])) == 3, expect=True)

# 内置兜底也要同步（离线时读它）
dh_start = CLIENT.index("const DEFAULT_HELP")
dh = CLIENT[dh_start:CLIENT.index("function remoteIsSafeUrl")]
check("内置 DEFAULT_HELP 也只剩 2 条工具资料",
      dh.count('url: "https://github.com/ai-yukin/dsh-0-tools"') == 1
      and dh.count("issues/new") == 1, expect=True)
check("内置兜底不再含 skillhub", "skillhub.cn" not in dh)
check("内置兜底不再含 awesome", "awesome-dsh-plugin.com" not in dh)

# ---------- 6. 导出/导入链接 + 用途说明 ----------
check("导出配置链接仍在", "导出配置" in CLIENT)
check("导入配置链接仍在", "导入配置" in CLIENT)
check("★ 已加导出/导入用途说明行", "先「导出配置」备份一份" in CLIENT)
check("说明行提到不必再去官网注册", "不必再一个个去官网注册" in CLIENT)

print("\n通过 %d / 失败 %d" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)