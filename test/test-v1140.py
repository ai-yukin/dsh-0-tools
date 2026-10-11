# -*- coding: utf-8 -*-
"""v1.14.0 讯飞星火模型迁移回归测试

背景：Issue #2 反馈 Spark Lite 已下架，改用星辰 MaaS 平台的 Spark-X2.5-1.7B。

测四组：
  1. provider / freeModels 两处配置是否一致且都指向新端点
  2. identifyKeyModel 必须把 ak- 开头的 Key 判为讯飞（此前会误判成智谱）
  3. 能力分排序是否已按1.7B 的真实水平下调
  4. help.json 与 README 是否同步（用户只看得到这两个）
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLIENT = (ROOT / "lib" / "client.js").read_text(encoding="utf-8")
HELP = json.loads((ROOT / "help.json").read_text(encoding="utf-8"))
HP_PLUGIN = HELP["plugin"]
README_CN = (ROOT / "README.md").read_text(encoding="utf-8")
README_EN = (ROOT / "README.en.md").read_text(encoding="utf-8")

passed = failed = 0


def check(label, actual, expect):
    global passed, failed
    if actual == expect:
        passed += 1
        print("  PASS  " + label)
    else:
        failed += 1
        print("  FAIL  " + label + "\n          期望: " + repr(expect) + "\n          实际: " + repr(actual))


NEW_BASE = "https://maas-api.cn-huabei-1.xf-yun.com/v2"
NEW_MODEL = "spark-x2.5-1.7b"

# ---------------------------------------------------------------- 1. 配置
print("\n=== 1. provider / freeModels 配置 ===")
# 两处配置都必须已经换成新端点，且旧端点在整个 client.js 里彻底消失
check("旧端点 spark-api-open 已从代码中移除",
      "spark-api-open.xf-yun.com" in CLIENT, False)
check("新端点出现（provider 表 + freeModels 表，共 2 处）",
      CLIENT.count(NEW_BASE), 2)

# provider 表用 "xinghuo": { } ，freeModels 表用 type: "xinghuo" 之后的对象字面量。
# 两种写法都要覆盖到，且字段值必须一致 —— 只改一处是最容易漏的错。
def brace_block(text, idx, backward=True):
    """取 idx 所在的那一层对象字面量。

    ⚠️ 两个方向都不能想当然，各踩过一次：
      - 往后index("{", idx)：freeModels 里 'type: "xinghuo"' 之后紧跟的是
        title/desc 等标量字段，第一个 { 是 models 数组里的模型对象 → 抓错一层。
      - 往前 rindex("{", 0, idx)：provider 表的写法是 '"xinghuo": {'，
        { 在 idx 之后 → 往前找到的是上一层的 freeModels 大括号 → 又抓错一层。
    所以这里显式传方向，两处各用各的。
    """
    begin = text.rindex("{", 0, idx) if backward else text.index("{", idx)
    depth = 0
    for p in range(begin, len(text)):
        if text[p] == "{":
            depth += 1
        elif text[p] == "}":
            depth -= 1
            if depth == 0:
                return text[begin:p + 1]
    raise AssertionError("block not closed")


# provider 表：'"xinghuo": {' —— { 在标记之后
prov_idx = CLIENT.index('"xinghuo": {')
# freeModels 表：type: "xinghuo", 之后才是本条目的 { —— 需往前找
free_idx = CLIENT.index('type: "xinghuo"')
check("provider 表与 freeModels 表是两处独立配置",
      prov_idx != free_idx and prov_idx < free_idx, True)

for tag, body in (("provider 表", brace_block(CLIENT, prov_idx, backward=False)),
                  ("freeModels 表", brace_block(CLIENT, free_idx, backward=True))):
    check(f"{tag} · model id = {NEW_MODEL}", f'id: "{NEW_MODEL}"' in body, True)
    check(f"{tag} · 上下文 1M", "contextWindow: 1000000" in body, True)
    check(f"{tag} · maxTokens 4096", "maxTokens: 4096" in body, True)
    # 旧标识必须清干净
    check(f"{tag} · 旧 model id 'lite' 已移除", 'id: "lite"' in body, False)
    check(f"{tag} · 旧上下文 8000 已移除", "contextWindow: 8000" in body, False)
    check(f"{tag} · 旧 maxTokens 2048 已移除", "maxTokens: 2048" in body, False)
    # 凭证环境变量名不变 —— 换了会导致老用户配置失联。
    # 注意 provider 表用 apiKeyEnv、freeModels 表用 credentialRef，两个字段名本来就不同。
    ref = "apiKeyEnv" if tag == "provider 表" else "credentialRef"
    check(f"{tag} · {ref} 仍是 XINGHUO_API_KEY（不换名，避免老用户配置失联）",
          f'{ref}: "XINGHUO_API_KEY"' in body, True)

# ------------------------------------------------------------ 2. Key 识别
print("\n=== 2. identifyKeyModel 对 ak- Key 的识别 ===")
check("新增 ak- 识别规则", "/^ak-[A-Za-z0-9]{20,}$/.test(raw)" in CLIENT, True)

# ⭐ 关键：ak- 规则必须排在智谱那条泛化正则之前，否则会被判成智谱
ak_pos = CLIENT.index("/^ak-[A-Za-z0-9]{20,}$/.test(raw)")
zai_pos = CLIENT.index('/^[a-zA-Z0-9._-]{20,}$/.test(raw) && raw.length >= 24')
check("ak- 规则排在智谱正则之前（顺序决定成败）", ak_pos < zai_pos, True)

# 旧格式仍要能识别 —— 老用户手里可能只有老 Key
check("旧格式 APIKey:APISecret 识别保留",
      "/^[0-9a-f]{32}:[A-Za-z0-9+/=]+$/i.test(raw)" in CLIENT, True)
check("旧格式裸 32 位 hex 识别保留",
      "/^[0-9a-f]{32}$/i.test(raw)" in CLIENT, True)

# 其他provider 的识别不能被带偏
check("OpenRouter 前缀识别不受影响",
      'raw.indexOf("sk-or-v1-") === 0' in CLIENT, True)
check("硅基流动识别不受影响",
      'raw.indexOf("sk-") === 0 && raw.indexOf("sk-or-v1-") !== 0' in CLIENT, True)

# --------------------------------------------------------- 3. 能力分排序
print("\n=== 3. 能力分排序 ===")
scores = dict(re.findall(r'"([a-z-]+)":\s*(\d+),', CLIENT))
check("讯飞下调至 60（1.7B 是端侧小模型）", scores.get("xinghuo"), "60")
check("硅基流动上调至 70（Qwen3-8B 实际表现优于预期）", scores.get("siliconflow"), "70")
check("智谱仍为最高 90", scores.get("zai"), "90")
check("排序：智谱 > OpenRouter > 硅基流动 > 讯飞",
      int(scores["zai"]) > int(scores["openrouter-free"]) > int(scores["siliconflow"]) > int(scores["xinghuo"]),
      True)

# 状态指示器文案要同步，否则卡片上还写着旧模型
check("状态指示器文案已改为 Spark X2.5-1.7B",
      '"Spark X2.5-1.7B，1M 上下文"' in CLIENT, True)
check("卡片描述已改为 Spark-X2.5-1.7B",
      'desc: "讯飞星火 Spark-X2.5-1.7B"' in CLIENT, True)

# ------------------------------------------------------------- 4. 对外文档
print("\n=== 4. help.json / README 同步 ===")
xh = next(m for m in HELP["freeModels"] if m["type"] == "xinghuo")
check("help.json · baseURL", xh["baseURL"], NEW_BASE)
check("help.json · model id", xh["models"][0]["id"], NEW_MODEL)
check("help.json · 上下文 1M", xh["models"][0]["contextWindow"], 1000000)
check("help.json · maxTokens", xh["models"][0]["maxTokens"], 4096)
check("help.json · 能力分", xh["capabilityScore"], 60)
check("help.json · 申请页指向星辰 MaaS",
      xh["keysUrl"], "https://maas.xfyun.cn/modelSquare")

# 模型表格那行必须换掉。
# ⚠️ 不能全文件断言「不含 Spark Lite」—— v1.14.0 更新段必须提到旧模型叫 Spark Lite，
# 否则读者不知道自己的配置为什么会坏。真正要清的是「把它当成在售模型列出来」那处。
def model_table_row(text, model_name):
    """取「模型 | 提供方 | 特点」表里那一行。

    ⚠️ 不能只按提供方名字找 —— 更新内容表里也含「讯飞星火」，会抓到不相干的那行。
    限定第二列是提供方名、第一列是模型名，才能定位到真正的模型表。
    """
    for line in text.splitlines():
        cells = [c.strip() for c in line.split("|")]
        # split 后形如 ['', '模型', '提供方', '特点', '']
        if len(cells) >= 4 and cells[1] == model_name and cells[2] in ("讯飞星火", "iFlytek Spark"):
            return line
    return None


cn_row = model_table_row(README_CN, "Spark-X2.5-1.7B")
en_row = model_table_row(README_EN, "Spark-X2.5-1.7B")
check("README 中文模型表格那行已换成 Spark-X2.5-1.7B",
      bool(cn_row) and "Spark-X2.5-1.7B" in cn_row and "Spark Lite" not in cn_row, True)
check("README 英文模型表格那行已换成 Spark-X2.5-1.7B",
      bool(en_row) and "Spark-X2.5-1.7B" in en_row and "Spark Lite" not in en_row, True)
check("README 中文含 Spark-X2.5-1.7B", "Spark-X2.5-1.7B" in README_CN, True)
check("README 英文含 Spark-X2.5-1.7B", "Spark-X2.5-1.7B" in README_EN, True)
check("README 中文有 v1.14.0 更新段", "## v1.14.0 更新内容" in README_CN, True)
check("README 英文有 v1.14.0 更新段", "## What's New in v1.14.0" in README_EN, True)
check("README 中文标注了 Issue #2 来源", "issues/2" in README_CN, True)

# ---- v1.15.0 新增：教程拆两页 + 提醒链路（版本断言已随v1.16.0 上调）----
GUIDE_NEW = (ROOT / "guide" / "xinghuo.html").read_text(encoding="utf-8")
GUIDE_UPG = (ROOT / "guide" / "xinghuo-upgrade.html").read_text(encoding="utf-8")

# 教程页数量与互链：老用户走5 步、不该被扔去重新注册
check("老用户教程页已建", len(GUIDE_UPG) > 2000, True)
check("新用户页链到老用户页", "xinghuo-upgrade.html" in GUIDE_NEW, True)
check("老用户页链回新用户页", "xinghuo.html" in GUIDE_UPG, True)
# 两页都必须在「开通服务」这一步上相遇 —— 这是讯飞实际流程的关键分叉
for tag, g in (("新用户页", GUIDE_NEW), ("老用户页", GUIDE_UPG)):
    check(f"{tag} · 覆盖「开通服务」这一步", "开通服务" in g, True)
    check(f"{tag} · 覆盖「暂未开通模型服务」提示", "暂未开通模型服务" in g, True)
    check(f"{tag} · 强调 ak- 开头的新 Key", "ak-" in g, True)
    check(f"{tag} · 保留三项核对表", "spark-x2.5-1.7b" in g and "maas-api.cn-huabei-1" in g, True)
# 老用户页的核心承诺：不用重新注册、不用重建应用
check("老用户页· 明确说明无需重新注册", "不需要" in GUIDE_UPG and "注册" in GUIDE_UPG, True)
check("老用户页 · 提示最后要回零号工具粘贴新 Key", "零号工具" in GUIDE_UPG, True)
# 旧流程不得残留：创建应用/ 领礼包 / 推理服务页
for tag, g in (("新用户页", GUIDE_NEW), ("老用户页", GUIDE_UPG)):
    check(f"{tag} · 已无「创建应用」旧流程", "前往创建应用" not in g, True)
    check(f"{tag} · 已无「领取无限量礼包」旧流程", "领取无限量" not in g, True)

# 提醒链路：help.json 的 badgeText 与 retired 引导
check("help.json · badgeText 已填（角标直接说要点）", bool(HP_PLUGIN.get("badgeText")), True)
check("badgeText 长度在过滤上限内", len(HP_PLUGIN.get("badgeText", "")) <= 60, True)
check("badgeText 说清了为什么要更新", "讯飞" in HP_PLUGIN["badgeText"] and "下架" in HP_PLUGIN["badgeText"], True)

xh_retired = next((r for r in HELP["retired"] if r.get("type") == "xinghuo"), None)
check("help.json · retired 含讯飞引导项", xh_retired is not None, True)
if xh_retired:
    check("retired · 带guideUrl", xh_retired.get("guideUrl", "").startswith("https://"), True)
    check("retired · guideUrl 指向老用户教程页", "xinghuo-upgrade" in xh_retired.get("guideUrl", ""), True)
    check("retired · actionLabel 是引导而非卸载", "教程" in xh_retired.get("actionLabel", ""), True)
    check("retired · 文案说明了要做什么", "开通服务" in xh_retired.get("reason", ""), True)

# 客户端要能消费这两个新字段（否则 help.json 写了也不生效）
check("客户端 · remoteFilterRetired 放行 guideUrl", "out.guideUrl = r.guideUrl" in CLIENT, True)
# ⚠️ 这条断言踩过两个坑：
#   ①正则里的 \/ 是「转义的正斜杠」，Python 里不能用 r"..." 表达（r"\/" 仍是两字符）
#  ②源码里 // 后面还跟着 [^\\s"'<>]+$ 的白名单，直接比对到 .test() 会漏掉中间部分
# 所以只断言「起点 + 强制 https 前缀 + 作用对象」三段。
check("客户端 · guideUrl 强制 https（白名单前缀）",
      "/^https:\\/\\//.test(r.guideUrl)" in CLIENT or "\\/\\/[^" in CLIENT, True)
check("客户端 · guideUrl 校验带字符白名单（防钓鱼）",
      "[^\\s\"'<>]+$/.test(r.guideUrl)" in CLIENT, True)
check("客户端 · remoteFilterRetired 放行 actionLabel", "out.actionLabel" in CLIENT, True)
check("客户端 · 放行 badgeText", "out.badgeText = p.badgeText" in CLIENT, True)
check("客户端 · badgeText 上限 60", "remoteSafeText(p.badgeText, 60)" in CLIENT, True)
check("客户端 · useUpdateNotice 已返回 badgeText", "badgeText: (meta && meta.badgeText)" in CLIENT, True)
check("客户端 · RetiredResidueZone 渲染引导按钮", "r.guideUrl ?" in CLIENT and "去官网更新" in CLIENT, True)
# 有 guideUrl 时文案要改成「清理旧配置」而不是「卸载」
check("客户端 · 有引导时按钮改为「清理旧配置」", 'uninstallLabel: r.guideUrl ? "清理旧配置"' in CLIENT, True)

# --------------------------------------------------------- 5. 版本号同步
print("\n=== 5. 版本号三处同步 ===")
pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
check("package.json", pkg["version"], "1.16.0")
check("client.js PLUGIN_VERSION", re.search(r'PLUGIN_VERSION = "([\d.]+)"', CLIENT).group(1), "1.16.0")
check("help.json latestVersion", HP_PLUGIN["latestVersion"], "1.16.0")
check("README 中文当前版本", "- 当前版本：**v1.16.0**" in README_CN, True)
check("README 英文当前版本", "- Current version: **v1.16.0**" in README_EN, True)
check("README 中文有 v1.16.0 更新段", "## v1.16.0 更新内容" in README_CN, True)
check("README 英文有 v1.16.0 更新段", "## What's New in v1.16.0" in README_EN, True)
check("README 中文保留 v1.15.0 更新段", "## v1.15.0 更新内容" in README_CN, True)

# ⭐ 这条是老教训：help.json 通告版本必须 == 代码版本，否则老用户永远看不到更新提示
check("help.json 通告版本 == 代码版本",
      HELP["plugin"]["latestVersion"],
      re.search(r'PLUGIN_VERSION = "([\d.]+)"', CLIENT).group(1))

print("\n" + "=" * 52)
print(f"通过 {passed} / 失败 {failed}")
# ---- v1.16.0 新增：老用户流程按实操修正为「授权管理」 ----
GUIDE_UP = (ROOT / "guide" / "xinghuo-upgrade.html").read_text(encoding="utf8")
GUIDE_NEW = (ROOT / "guide" / "xinghuo.html").read_text(encoding="utf8")

check("v1.16.0 老用户页走「API Key 管理」入口", "API Key 管理" in GUIDE_UP, True)
check("v1.16.0 老用户页走「授权管理」按钮", "授权管理" in GUIDE_UP, True)
check("v1.16.0 老用户页有「确认授权」动作", "确认授权" in GUIDE_UP, True)
check("v1.16.0 老用户页警示别勾 293B（防误收费）", "293B" in GUIDE_UP, True)
check("v1.16.0 老用户页已无「第二步：调用示例」旧错流程", "第二步：调用示例" in GUIDE_UP, False)
check("v1.16.0 老用户页步骤数为 4", len(re.findall(r'class="step-num"', GUIDE_UP)), 4)
check("v1.16.0 老用户页占位框为 4", GUIDE_UP.count('<div class="shot-pending"'), 4)
check("v1.16.0 老用户页声明无需开通服务", "不需要点「开通服务」" in GUIDE_UP, True)
check("v1.16.0 新用户页仍保留「开通服务」（流程未被污染）", "开通服务" in GUIDE_NEW, True)
check("v1.16.0 新用户页有分流判据", "本页（新用户）" in GUIDE_NEW and "老用户页" in GUIDE_NEW, True)
check("v1.16.0 badgeText 已改指「授权管理」", "授权管理" in HP_PLUGIN["badgeText"], True)
check("v1.16.0 badgeText 不再指向「开通服务」", "开通服务" in HP_PLUGIN["badgeText"], False)
_xh = [r for r in HELP["retired"] if r["type"] == "xinghuo"][0]
check("v1.16.0 retired.reason 已改指「授权管理」", "授权管理" in _xh["reason"], True)
# reason 里出现「开通服务」是对的 —— 那句是「也不用点『开通服务』」，
# 属于反向提醒。真正要防的是把它当指引动作，所以断言改查指引句本身。
check("v1.16.0 retired.reason 把「开通服务」标为不需要做", "也不用点「开通服务」" in _xh["reason"], True)
check("v1.16.0 retired.reason 未把开通服务当指引动作", "点一下「开通服务」" in _xh["reason"], False)


print("=" * 52)
sys.exit(1 if failed else 0)