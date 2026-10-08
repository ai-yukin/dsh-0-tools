# 验证 install.bat (findstr) 与 install.sh (grep -E) 的版本闸门判定是否等价且正确
import re, sys

# ---- findstr /r 正则 → Python 等价（findstr 是不锚定的子串匹配）----
# bat 用: findstr /r /c:"^0\.[3-9]\." /c:"^[1-9]\."   （多个 /c 任一命中即拦截）
BAT_BLOCK = re.compile(r'^0\.[3-9]\.|^[1-9]\.')
# sh 用: grep -qE '^0\.[3-9]\.|^[1-9]\.'
SH_BLOCK = re.compile(r'^0\.[3-9]\.|^[1-9]\.')

CASES = [
    # (版本, 是否应被拦截)
    ("0.1.5", False), ("0.1.7-rc.1", False), ("0.1.7-rc.2", False),
    ("0.1.7", False), ("0.1.8", False), ("0.1.9", False),
    ("0.2.0-rc.1", False), ("0.2.0-rc.2", False), ("0.2.0", False),
    ("0.2.1-alpha.1", False), ("0.2.1", False), ("0.2.9", False),
    ("0.3.0-rc.1", True), ("0.3.0", True), ("0.3.5", True),
    ("0.4.0", True), ("0.9.9", True),
    ("1.0.0", True), ("1.5.2", True), ("2.0.0", True),
]

print(f"{'版本':<18}{'期望':<8}{'bat 判定':<12}{'sh 判定':<12}{'一致':<6}")
print("-" * 60)
fails = 0
for ver, should_block in CASES:
    bat = bool(BAT_BLOCK.search(ver))
    sh = bool(SH_BLOCK.search(ver))
    ok = (bat == should_block) and (sh == should_block) and (bat == sh)
    if not ok: fails += 1
    print(f"{ver:<18}{('拦截' if should_block else '放行'):<8}"
          f"{('拦截' if bat else '放行'):<12}{('拦截' if sh else '放行'):<12}{'✅' if ok else '❌'}")

print("-" * 60)
print(f"共 {len(CASES)} 例，失败 {fails}例")
sys.exit(1 if fails else 0)