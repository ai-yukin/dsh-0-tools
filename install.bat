@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

rem ============================================================
rem dsh-0-tools 一键安装脚本（install.bat）
rem ============================================================
rem 作用：
rem   1. 备份当前 ~/.dsh/profiles/web/node_modules/dsh-0-tools（如有）
rem   2. 把本目录（本地源码）安装到 dsh web profile
rem   3. 启动 dsh web
rem   4. 浏览器打开 http://127.0.0.1:3080
rem
rem 安装前请确保：没有正在运行的 dsh web（否则 3080 被占用，新插件不生效）
rem ============================================================

echo.
echo ===== dsh-0-tools 一键安装 =====
echo.

rem ---------- 前置检查：DSH 本体是否已安装 ----------
where dsh >nul 2>nul
if errorlevel 1 (
    echo.
    echo [警告] 未检测到 DSH（DeepSeek Harness）！
    echo 本插件是 DSH 的插件，需要先安装 DSH 本体才能继续。
    echo.
    echo 二选一安装 DSH：
    echo   方式 A（免安装，推荐新手）：npx @deepseek-ai/dsh web
    echo   方式 B（全局安装）：        npm install -g @deepseek-ai/dsh
    echo.
    echo 安装好 DSH 后，重新运行本脚本即可。
    echo.
    pause
    exit /b 1
)
echo     已检测到 DSH，继续安装插件...
echo.

set "PLUGIN_SRC=%~dp0"
if "%PLUGIN_SRC:~-1%"=="\" set "PLUGIN_SRC=%PLUGIN_SRC:~0,-1%"
set "PROFILE_DIR=%USERPROFILE%\.dsh\profiles\web"
set "TARGET=%PROFILE_DIR%\node_modules\dsh-0-tools"
set "BAK=%TARGET%.bak"

echo [1/4] 备份当前已安装的插件（如有）...
if exist "%BAK%" rmdir /S /Q "%BAK%" 2>nul
if exist "%TARGET%" (
    xcopy /E /I /H /Y "%TARGET%" "%BAK%" >nul
    echo      已备份到 %BAK%
) else (
    echo      当前没有已安装版本，跳过备份
)

echo.
echo [2/4] 安装 dsh-0-tools 到 dsh web profile...
rem 优先使用 dsh plugin 命令（会调用 pnpm）；失败则直接复制源码目录
dsh plugin --profile web add "%PLUGIN_SRC%"
if %errorlevel% neq 0 (
    echo      dsh plugin add 失败，改用直接复制...
    rmdir /S /Q "%TARGET%" 2>nul
    xcopy /E /I /H /Y "%PLUGIN_SRC%" "%TARGET%" >nul
)

echo.
echo [3/4] 启动 dsh web（新窗口，保留日志）...
start "dsh web" cmd /c "dsh web"

echo.
echo [4/4] 等待 6 秒后打开浏览器...
timeout /T 6 /NOBREAK >nul
start http://127.0.0.1:3080/

echo.
echo ===== 安装完成 =====
echo 安装成功自检：
echo   1. 设置弹窗里应有「零号工具」页签（三分区：配置中心/费用管控/帮助中心）。
echo   2. 选中 DeepSeek 系列大模型时，左下角应出现高峰/空闲计价条。
echo   3. 选中智谱免费模型时，左下角计价条自动隐藏。
echo   4. 「帮助」按钮常驻左下角，点击弹出官方资料/精选资料。
echo   5. 设置页配置中心：未配置时显示配置表单；已配置时显示状态 + 一键卸载。
echo.
echo 如需卸载：
echo   dsh plugin --profile web remove dsh-0-tools
echo 如需回退旧版，在 PowerShell/cmd 里执行：
echo   rmdir /S /Q "%TARGET%" ^&^& xcopy /E /I /H /Y "%BAK%" "%TARGET%"
echo.
pause
