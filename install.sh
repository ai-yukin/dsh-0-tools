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
echo -e "${BLUE}[4/5] 等待 6 秒后打开浏览器...${NC}"
sleep 6
$OPEN_CMD "http://127.0.0.1:3080/" 2>/dev/null || echo "     请手动打开 http://127.0.0.1:3080/"

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
dsh web &
DSH_PID=$!
sleep 6
open "http://127.0.0.1:3080/" 2>/dev/null || xdg-open "http://127.0.0.1:3080/" 2>/dev/null
echo "DSH 已启动，浏览器已打开。按 Ctrl+C 停止服务。"
wait $DSH_PID
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
