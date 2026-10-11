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
def table_row(text, marker):
    for line in text.splitlines():
        if line.startswith("|") and marker in line:
            return line
    return None


cn_row = table_row(README_CN, "讯飞星火")
en_row = table_row(README_EN, "iFlytek Spark")
check("README 中文模型表格那行已换成 Spark-X2.5-1.7B",
      bool(cn_row) and "Spark-X2.5-1.7B" in cn_row and "Spark Lite" not in cn_row, True)
check("README 英文模型表格那行已换成 Spark-X2.5-1.7B",
      bool(en_row) and "Spark-X2.5-1.7B" in en_row and "Spark Lite" not in en_row, True)
check("README 中文含 Spark-X2.5-1.7B", "Spark-X2.5-1.7B" in README_CN, True)
check("README 英文含 Spark-X2.5-1.7B", "Spark-X2.5-1.7B" in README_EN, True)
check("README 中文有 v1.14.0 更新段", "## v1.14.0 更新内容" in README_CN, True)
check("README 英文有 v1.14.0 更新段", "## What's New in v1.14.0" in README_EN, True)
check("README 中文标注了 Issue #2 来源", "issues/2" in README_CN, True)

# --------------------------------------------------------- 5. 版本号同步
print("\n=== 5. 版本号三处同步 ===")
pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
check("package.json", pkg["version"], "1.14.0")
check("client.js PLUGIN_VERSION", re.search(r'PLUGIN_VERSION = "([\d.]+)"', CLIENT).group(1), "1.14.0")
check("help.json latestVersion", HELP["plugin"]["latestVersion"], "1.14.0")
check("README 中文当前版本", "- 当前版本：**v1.14.0**" in README_CN, True)
check("README 英文当前版本", "- Current version: **v1.14.0**" in README_EN, True)

# ⭐ 这条是老教训：help.json 通告版本必须 == 代码版本，否则老用户永远看不到更新提示
check("help.json 通告版本 == 代码版本",
      HELP["plugin"]["latestVersion"],
      re.search(r'PLUGIN_VERSION = "([\d.]+)"', CLIENT).group(1))

print("\n" + "=" * 52)
print(f"通过 {passed} / 失败 {failed}")
print("=" * 52)
sys.exit(1 if failed else 0)