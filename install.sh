#!/bin/bash
# ============================================================
# dsh-0-tools 一键安装脚本（install.sh）—— macOS / Linux 版
# ============================================================
# 作用：
#   0. 前置检查：DSH 若正在运行则提示（避免端口占用/热加载不生效）
#   1. 备份当前 ~/.dsh/profiles/web/node_modules/dsh-0-tools（如有）
#   2. 把本目录（本地源码）安装到 dsh web profile
#   3. 启动 dsh web
#   4. 浏览器打开 http://127.0.0.1:3080
#   5. 创建桌面快捷方式「DeepSeek Harness.command」
#
# 安装前请确保：没有正在运行的 dsh web（否则 3080 被占用，新插件不生效）
# macOS 依赖：Homebrew（用于自动安装 Node.js）
# ============================================================

set -e

# ---------- 颜色输出 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}===== dsh-0-tools 一键安装（macOS / Linux）=====${NC}"
echo ""

# ---------- 检测操作系统 ----------
OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then
    IS_MAC=true
    DESKTOP="$HOME/Desktop"
    # macOS 桌面可能在 iCloud 里
    if [ ! -d "$DESKTOP" ] && [ -d "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop" ]; then
        DESKTOP="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop"
    fi
    OPEN_CMD="open"
else
    IS_MAC=false
    DESKTOP="$HOME/Desktop"
    OPEN_CMD="xdg-open"
fi

# ---------- 版本检查：装之前先告诉用户这是不是最新版 ----------
# 解决"用户装到旧版"的核心问题：脚本本身不下载任何东西，
# 它装的是"脚本自己所在目录"的版本，所以先本地报出实际版本。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_VER="unknown"
if [ -f "$SCRIPT_DIR/package.json" ]; then
    LOCAL_VER=$(grep '"version"' "$SCRIPT_DIR/package.json" | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
fi
echo ""
echo -e "${BLUE}[版本] 本地源码版本：v${LOCAL_VER}${NC}"

# 尝试获取远程最新版（GitHub 优先，不通则回落 Gitee；均失败不影响安装）
REMOTE_VER=""
for U in \
    "https://raw.githubusercontent.com/ai-yukin/dsh-0-tools/main/package.json" \
    "https://gitee.com/ai-yukin/dsh-0-tools/raw/main/package.json" ; do
    if [ -z "$REMOTE_VER" ]; then
        REMOTE_VER=$(curl -fsSL --max-time 8 "$U" 2>/dev/null \
            | grep '"version"' | head -1 \
            | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/') || true
    fi
done

if [ -n "$REMOTE_VER" ]; then
    if [ "$LOCAL_VER" = "$REMOTE_VER" ]; then
        echo -e "${GREEN}[版本] ✅ 你安装的是最新版 v${LOCAL_VER}${NC}"
    else
        echo -e "${YELLOW}[版本] ⚠️  本地是 v${LOCAL_VER}，但远程最新是 v${REMOTE_VER}${NC}"
        echo ""
        echo "       你的版本不是最新。建议先更新源码再重新运行本脚本："
        echo "         cd \"$SCRIPT_DIR\""
        echo "         git pull origin main"
        echo ""
        echo "       （国内网络可改用镜像：git pull gitee main）"
        echo ""
    fi
else
    echo -e "${YELLOW}[版本] 未能获取远程版本号（网络不通），跳过版本比对。${NC}"
    echo "       若怀疑版本过旧，可到 GitHub/Gitee 仓库页确认最新版本号。"
fi
echo ""

# ---------- 前置检查：DSH 本体是否已安装（未装则自动安装） ----------
if ! command -v dsh &> /dev/null; then
    echo ""
    echo -e "${YELLOW}[提示] 未检测到 DSH（DeepSeek Harness），开始自动安装...${NC}"
    echo ""

    # 检测 Node.js（DSH 依赖 Node 环境）
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}[提示] 未检测到 Node.js，尝试自动安装...${NC}"

        if [ "$IS_MAC" = true ]; then
            # macOS：用 Homebrew 安装
            if ! command -v brew &> /dev/null; then
                echo -e "${RED}[错误] 本机没有 Homebrew，无法自动安装 Node.js。${NC}"
                echo "       请先安装 Homebrew：https://brew.sh/"
                echo "       或手动到 https://nodejs.org/ 下载 LTS 版安装后，重新运行本脚本。"
                echo ""
                read -p "按回车键退出..."
                exit 1
            fi
            echo -e "${BLUE}[1] 正在通过 Homebrew 安装 Node.js LTS，请稍候...${NC}"
            brew install node
        else
            # Linux：尝试用包管理器
            if command -v apt &> /dev/null; then
                echo -e "${BLUE}[1] 正在通过 apt 安装 Node.js，请稍候...${NC}"
                sudo apt update && sudo apt install -y nodejs npm
            elif command -v yum &> /dev/null; then
                echo -e "${BLUE}[1] 正在通过 yum 安装 Node.js，请稍候...${NC}"
                sudo yum install -y nodejs npm
            else
                echo -e "${RED}[错误] 无法自动安装 Node.js（未识别到包管理器）。${NC}"
                echo "       请手动到 https://nodejs.org/ 下载 LTS 版安装后，重新运行本脚本。"
                echo ""
                read -p "按回车键退出..."
                exit 1
            fi
        fi

        if ! command -v node &> /dev/null; then
            echo -e "${RED}[错误] Node.js 安装失败或未在 PATH 中识别到。${NC}"
            echo "       请手动安装 Node.js 后重新运行本脚本。"
            echo ""
            read -p "按回车键退出..."
            exit 1
        fi
        echo -e "${GREEN}     Node.js 安装成功，继续安装 DSH...${NC}"
        echo ""
    else
        echo -e "${GREEN}     已检测到 Node.js，跳过安装。${NC}"
        echo ""
    fi

    echo -e "${BLUE}[2] 正在通过 npm 全局安装 DSH（@deepseek-ai/dsh），请稍候...${NC}"
    if ! npm install -g @deepseek-ai/dsh; then
        echo ""
        echo -e "${RED}[错误] DSH 自动安装失败。请手动执行以下命令后，重新运行本脚本：${NC}"
        echo "     npm install -g @deepseek-ai/dsh"
        echo "     国内网络较慢时可改用镜像：npm install -g @deepseek-ai/dsh --registry=https://registry.npmmirror.com"
        echo ""
        read -p "按回车键退出..."
        exit 1
    fi

    # 复核安装结果
    if ! command -v dsh &> /dev/null; then
        echo ""
        echo -e "${YELLOW}[提示] DSH 已安装，但当前 shell 尚未识别到 dsh 命令（PATH 未刷新）。${NC}"
        echo "       请关闭本终端窗口，重新打开终端后再次运行本脚本。"
        echo ""
        read -p "按回车键退出..."
        exit 1
    fi
    echo -e "${GREEN}     DSH 安装成功，继续安装插件...${NC}"
    echo ""
else
    echo -e "${GREEN}     已检测到 DSH，跳过自动安装。${NC}"
    echo ""
fi

# ---------- 版本兼容性闸门 ----------
# v1.11.0 起本插件同时支持 DSH 0.1.5 ~ 0.1.x 与 0.2.x
# （peerDependencies 声明为 "@deepseek-ai/dsh": ">=0.1.5 <0.3"）。
# 这里只拦 0.3 及以上 —— 那一代尚未验证，装上去大概率加载不了。
DSH_VER="$(dsh --version 2>/dev/null | head -n1 | tr -d '\r')"
if [ -z "$DSH_VER" ]; then
    echo -e "${YELLOW}     未能读取 DSH 版本（可能 PATH 未刷新），跳过版本校验。${NC}"
    echo ""
elif echo "$DSH_VER" | grep -qE '^0\.[3-9]\.|^[1-9]\.'; then
    echo -e "${RED}     [错误] 你安装的是 DSH $DSH_VER，本插件尚未验证支持该版本。${NC}"
    echo ""
    echo "       本插件当前支持范围：DSH 0.1.5 ~ 0.2.x"
    echo "       DSH 0.3 起可能存在不兼容改动，本插件暂不承诺支持。"
    echo ""
    echo "       解决办法（二选一）："
    echo "         [推荐] 改用已验证的版本："
    echo "             npm install -g @deepseek-ai/dsh@0.1.7-rc.2"
    echo "         [或] 等待本插件发布支持新版本的更新。"
    echo ""
    read -p "按回车键退出..."
    exit 1
else
    echo -e "${GREEN}     ✅ DSH 版本兼容（支持 0.1.5 ~ 0.2.x），继续安装插件...${NC}"
    echo ""
fi

# ---------- 路径设置 ----------
PLUGIN_SRC="$(cd "$(dirname "$0")" && pwd)"
PROFILE_DIR="$HOME/.dsh/profiles/web"
TARGET="$PROFILE_DIR/node_modules/dsh-0-tools"
BAK="$TARGET.bak"

# ---------- 前置检查：DSH 是否正在运行 ----------
if [ "$IS_MAC" = true ]; then
    if lsof -i :3080 -sTCP:LISTEN &> /dev/null; then
        PORT_IN_USE=true
    else
        PORT_IN_USE=false
    fi
else
    if ss -tlnp 2>/dev/null | grep -q ':3080' || netstat -tlnp 2>/dev/null | grep -q ':3080'; then
        PORT_IN_USE=true
    else
        PORT_IN_USE=false
    fi
fi

if [ "$PORT_IN_USE" = true ]; then
    echo ""
    echo -e "${YELLOW}[提示] 检测到 dsh web 正在运行（端口 3080 已被占用）。${NC}"
    echo "       继续安装可能导致新插件不生效或端口冲突。"
    echo "       建议先关闭运行中的 DeepSeek Harness 窗口，再重新运行本脚本。"
    echo ""
    read -p "仍要继续安装吗？[y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已退出，未做任何改动。"
        read -p "按回车键退出..."
        exit 0
    fi
fi

# ---------- [1/5] 备份当前已安装的插件 ----------
echo ""
echo -e "${BLUE}[1/5] 备份当前已安装的插件（如有）...${NC}"
if [ -d "$BAK" ]; then
    rm -rf "$BAK"
fi
if [ -d "$TARGET" ]; then
    cp -R "$TARGET" "$BAK"
    echo -e "${GREEN}     已备份到 $BAK${NC}"
else
    echo "     当前没有已安装版本，跳过备份"
fi

# ---------- [2/5] 安装 dsh-0-tools 到 dsh web profile ----------
echo ""
echo -e "${BLUE}[2/5] 安装 dsh-0-tools 到 dsh web profile...${NC}"

# 优先使用 dsh plugin 命令；失败则白名单复制插件运行所需文件
if dsh plugin --profile web add "$PLUGIN_SRC"; then
    echo -e "${GREEN}     dsh plugin add 成功${NC}"
else
    echo -e "${YELLOW}     dsh plugin add 失败，改用白名单直接复制...${NC}"
    rm -rf "$TARGET" 2>/dev/null
    mkdir -p "$TARGET/lib"
    cp "$PLUGIN_SRC/lib/index.js" "$TARGET/lib/"
    cp "$PLUGIN_SRC/lib/client.js" "$TARGET/lib/"
    cp "$PLUGIN_SRC/cordis.patch.yml" "$TARGET/" 2>/dev/null || true
    cp "$PLUGIN_SRC/package.json" "$TARGET/"
    cp "$PLUGIN_SRC/help.json" "$TARGET/" 2>/dev/null || true
    cp "$PLUGIN_SRC/LICENSE" "$TARGET/" 2>/dev/null || true
    [ -f "$PLUGIN_SRC/README.md" ] && cp "$PLUGIN_SRC/README.md" "$TARGET/"
    [ -f "$PLUGIN_SRC/README.en.md" ] && cp "$PLUGIN_SRC/README.en.md" "$TARGET/"
    [ -f "$PLUGIN_SRC/install.sh" ] && cp "$PLUGIN_SRC/install.sh" "$TARGET/"
    echo -e "${GREEN}     白名单复制完成${NC}"
fi

# ---------- [3/5] 启动 dsh web ----------
echo ""
echo -e "${BLUE}[3/5] 启动 dsh web（后台运行）...${NC}"

if [ "$IS_MAC" = true ]; then
    # macOS：用 osascript 开新终端窗口运行 dsh web
    osascript -e 'tell application "Terminal" to do script "dsh web"' 2>/dev/null || \
    nohup dsh web > /tmp/dsh-web.log 2>&1 &
    echo "     已在新终端窗口启动 dsh web（日志可在终端窗口查看）"
else
    # Linux：后台运行
    nohup dsh web > /tmp/dsh-web.log 2>&1 &
    echo "     已后台启动 dsh web（日志：/tmp/dsh-web.log）"
fi

# ---------- [4/5] 等待后打开浏览器 ----------
echo ""
echo -e "${BLUE}[4/5] 等待 DSH 启动...${NC}"
# v1.10.0 修正：DSH 0.1.7 起启用 web 认证，直接开 http://127.0.0.1:3080/
# 会返回 401。dsh web 启动时会打印带 ?token= 的真实可访问地址，
# 由 DSH 自己负责打开，这里不再强开无 token 的裸地址。
sleep 6
echo ""
echo "  DSH 已在后台启动（日志：/tmp/dsh-web.log）。"
echo "  若浏览器未自动打开，请从日志中复制含 ?token= 的完整地址打开："
echo "    grep -o 'http://127.0.0.1:[0-9]*/?token=[^ ]*' /tmp/dsh-web.log | head -1"
echo "  （DSH 0.1.7 起需要这个 token，直接开 127.0.0.1:3080 会显示 401）"
echo ""

# ---------- [5/5] 创建桌面快捷方式 ----------
echo ""
echo -e "${BLUE}[5/5] 创建桌面快捷方式「DeepSeek Harness」...${NC}"

if [ ! -d "$DESKTOP" ]; then
    mkdir -p "$DESKTOP" 2>/dev/null || true
fi

SHORTCUT="$DESKTOP/DeepSeek Harness.command"

cat > "$SHORTCUT" << 'EOF'
#!/bin/bash
# DeepSeek Harness 启动快捷方式
echo "正在启动 DeepSeek Harness (dsh web)..."
# v1.10.0：不再自动打开 http://127.0.0.1:3080/ ——
# DSH 0.1.7 起该地址返回 401，dsh web 会自己打开带 ?token= 的地址。
dsh web
echo ""
echo "按 Ctrl+C 停止服务。"
EOF

chmod +x "$SHORTCUT"

if [ -f "$SHORTCUT" ]; then
    echo -e "${GREEN}     已创建桌面快捷方式：$SHORTCUT${NC}"
else
    echo -e "${YELLOW}[警告] 桌面快捷方式创建失败，不影响使用（可从命令行运行 dsh web）${NC}"
fi

# ---------- 安装完成 ----------
echo ""
echo -e "${GREEN}===== 安装完成 =====${NC}"
echo ""
echo "安装成功自检："
echo "  1. 设置弹窗里应有「零号工具」页签（三分区：配置中心/费用管控/帮助中心）"
echo "  2. 选中 DeepSeek 系列大模型时，左下角应出现高峰/空闲计价条"
echo "  3. 选中智谱免费模型时，左下角计价条自动隐藏"
echo "  4. 「帮助」按钮常驻左下角，点击弹出官方资料/精选资料"
echo "  5. 设置页配置中心：未配置时显示配置表单；已配置时显示状态 + 一键卸载"
echo ""
echo "如需卸载："
echo "  dsh plugin --profile web remove dsh-0-tools"
echo "如需回退旧版："
echo "  rm -rf \"$TARGET\" && cp -R \"$BAK\" \"$TARGET\""
echo ""
read -p "按回车键退出..."
