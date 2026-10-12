#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v1.16.3 回归测试：③ 帮助中心单块排版（用户设计版式）。

用户判断：帮助中心与「关于·About」两块定位重叠 → 合并；随后又重新排版为
单块布局，不再用标签页切换：

    ✦零号工具 dsh-0-tools（v1.16.2）✦帮助版本xxxx ✦作者 ✦关注作者公众号 ✦反馈问题
    ─────────────
    DSH 官方资料：三条链接
    ─────────────
    API Key 备份：✦导出 ✦导入 + 一行灰色说明

三处入口的落点是本测试的重点：
    · 零号工具 dsh-0-tools → GitHub 仓库（超链）
    · 关注作者公众号      → 二维码图片（用户拍板：给图不给链）
    · 反馈问题            → GitHub Issues（超链）
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT = io.open(os.path.join(ROOT, "lib", "client.js"), encoding="utf-8").read()
HELP = json.load(io.open(os.path.join(ROOT, "help.json"), encoding="utf-8"))
QR = os.path.join(ROOT, "images", "wechat-qrcode.png")

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


def unescape_js(s):
    """只还原 \\uXXXX，保留其余字节。

    ⚠️ 绝不能用 .encode('utf-8').decode('unicode_escape') ——
    它把 UTF-8 字节当 latin-1 逐字节解码，中文会全变乱码。
    """
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)


def strip_comments(src):
    """剥掉注释再查内容。

    ⚠️ 查「某文案是否已删除」时必须先剥注释 —— 代码注释里往往正好写着
    被删掉的那句话，全文 grep 会命中注释并误判成「没删」。

    ⚠️⚠️ 但不能简单用 re.sub(r'//[^\\n]*') —— 它会把 URL 里的 "//"
    （如 https://github.com/...）当成行注释，把后面整行删掉。
    正解是逐字符扫描，跟踪「是否在字符串内」：
      · 遇到 // 且不在字符串里 → 行注释，跳到行尾
      · 遇到引号 → 切换字符串状态（处理转义）
      · 遇到 /* 且不在字符串里 → 块注释，跳到 */
    """
    out = []
    i, n = 0, len(src)
    quote = None
    while i < n:
        c = src[i]
        if quote:
            out.append(c)
            if c == "\\" and i + 1 < n:      # 转义字符，连下一个一起带过
                out.append(src[i + 1])
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in "\"'`":
            quote = c
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


CODE = strip_comments(CLIENT)

print("=== v1.16.3 帮助中心单块排版 ===")

# ---------- 1. 卡片顺序 ----------
sec = CLIENT[CLIENT.index("function SettingsSection("):CLIENT.index("function FooterActions(")]
titles = [unescape_js(m.group(1)) for m in re.finditer(r'CARD_TITLE, children: "([^"]*)"', sec)]
check("设置区 3 张卡片", len(titles) == 3)
check("第 1 张是① 零费用·免费模型管家中心", titles[0] == "① 零费用·免费模型管家中心" if titles else False)
check("★ 第 2 张是② 零失控·费用管控中心", titles[1] == "② 零失控·费用管控中心" if len(titles) > 1 else False)
check("★ 第 3 张是③ 零门槛·小白帮助中心", titles[2] == "③ 零门槛·小白帮助中心" if len(titles) > 2 else False)

# ---------- 2. 标签页切换已移除 ----------
check("★ 标签页切换按钮已移除", "TAB_BTN_BASE" not in CODE)
check("★ 旧标签名「工具资料」不再是 UI 文案", 'children: "工具资料"' not in CODE)
check("★ 旧标签名「官方资料」不再是按钮", 'children: "官方资料"' not in CODE)
check("标签切换 state 已移除", 'useState("selected")' not in CODE)

# ---------- 3. AboutBlock 已并入，组件不再独立 ----------
check("★ AboutBlock 组件已消失（内容并入 HelpContent）", "function AboutBlock(" not in CODE)
check("AboutBlock 已不再被渲染", "(AboutBlock," not in CODE)

# ---------- 4. 第一行：五个条目 ----------
check("★ 第一行含「零号工具 dsh-0-tools（v+版本号）」",
      '"✦零号工具 dsh-0-tools（v" + PLUGIN_VERSION + "）"' in CODE)
check("★ 版本号引用 PLUGIN_VERSION（不硬编码）", CODE.count("PLUGIN_VERSION") >= 2)
check("★ 第一行含「帮助版本」+ 远端版本号", '"✦帮助版本" + data.version' in CODE)
check("★ 第一行含「作者：ai-yukin」", '"✦作者：ai-yukin"' in CODE)
check("★ 离线内置时有提示、已同步时不加噪",
      'source === "remote" ? null : "（离线内置）"' in CODE)

# ---------- 5. 三处超链落点（本次需求核心） ----------
check("★ 零号工具 dsh-0-tools 指向 GitHub 仓库",
      'href: "https://github.com/ai-yukin/dsh-0-tools"' in CODE)
check("★ 反馈问题 指向 GitHub Issues",
      'href: "https://github.com/ai-yukin/dsh-0-tools/issues/new"' in CODE)
check("★ 关注作者公众号 指向二维码图片",
      'REPO_RAW_BASE + "images/wechat-qrcode.png"' in CODE)
check("★ 二维码走仓库 raw 地址常量",
      'const REPO_RAW_BASE = "https://raw.githubusercontent.com/' in CODE)
check("★ 超链新窗口打开且不带 opener",
      'rel: props.href ? "noreferrer" : undefined' in CODE)
check("★ 文案是「✦关注作者公众号」", '"✦关注作者公众号"' in CODE)
check("★ 文案是「✦反馈问题（GitHub Issues）」", '"✦反馈问题（GitHub Issues）"' in CODE)

# ---------- 6. 二维码图片真实存在 ----------
check("★ 仓库内存在二维码图片", os.path.isfile(QR))
if os.path.isfile(QR):
    raw = io.open(QR, "rb").read()
    check("二维码是合法 PNG", raw[:8] == b"\x89PNG\r\n\x1a\n")
    check("二维码体积正常（非空壳）", len(raw) > 5000)
    w = int.from_bytes(raw[16:20], "big")
    h = int.from_bytes(raw[20:24], "big")
    check("二维码是正方形", w == h, expect=True)
    check("二维码边长足够扫码（≥200px）", w >= 200, expect=True)

# ---------- 7. DSH 官方资料区 ----------
check("★ 有「DSH 官方资料：」标题行", '"DSH 官方资料："' in CODE)
check("官方资料列表仍渲染", "HelpLinkList, { items: data.official" in CODE)
check("官方资料条数保持 3", len(HELP.get("official", [])) == 3)
# selected 已不再渲染（链接都并入第一行超链），但 help.json 里保留该字段，
# 以免远程旧 help.json 走过滤链时被误伤；此处确认它仍是合法结构。
check("help.json selected 字段仍是合法数组", isinstance(HELP.get("selected"), list))

# ---------- 8. API Key 备份区 ----------
check("★ 有「API Key 备份：」标题行", '"API Key 备份："' in CODE)
check("★ 导出按钮文案为「✦导出」", '"✦导出"' in CODE)
check("★ 导入按钮文案为「✦导入」", '"✦导入"' in CODE)
check("★ 导出仍走 localStorage 备份键",
      'localStorage.getItem("dsh0_free_model_backup")' in CODE)
check("★ 导入仍走 doAutoInstall 写回", "doAutoInstall(modelType, apiKey, BUILTIN_FREE_MODELS)" in CODE)
check("★ 保留灰色说明行", "为防配置丢失可先导出保存，导入即可写回免费模型 API Key" in CODE)

# ---------- 9. 分隔线 ----------
check("★ 两处分隔线", CODE.count('borderTop: "1px solid #e5e6eb"') == 2)

print("\n通过 %d / 失败 %d" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)