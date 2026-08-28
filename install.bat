@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

rem ============================================================
rem dsh-0-tools 一键安装脚本（install.bat）
rem ============================================================
rem 作用：
rem   0. 前置检查：DSH 若正在运行则提示（避免端口占用/热加载不生效）
rem   1. 备份当前 ~/.dsh/profiles/web/node_modules/dsh-0-tools（如有）
rem   2. 把本目录（本地源码）安装到 dsh web profile
rem   3. 启动 dsh web
rem   4. 浏览器打开 http://127.0.0.1:3080
rem   5. 创建桌面快捷方式「DeepSeek Harness」
rem
rem 安装前请确保：没有正在运行的 dsh web（否则 3080 被占用，新插件不生效）
rem ============================================================

echo.
echo ===== dsh-0-tools 一键安装 =====
echo.

rem ---------- 前置检查：DSH 本体是否已安装（未装则自动安装） ----------
where dsh >nul 2>nul
if errorlevel 1 (
    echo.
    echo [提示] 未检测到 DSH（DeepSeek Harness），开始自动安装...
    echo.

    rem 检测 Node.js（DSH 依赖 Node 环境）
    where node >nul 2>nul
    if errorlevel 1 (
        echo [提示] 未检测到 Node.js，尝试用 winget 自动安装 Node.js LTS...
        where winget >nul 2>nul
        if errorlevel 1 (
            echo [错误] 本机没有 winget，无法自动安装 Node.js。
            echo       请手动到 https://nodejs.org/ 下载 LTS 版安装后，重新运行本脚本。
            echo.
            pause
            exit /b 1
        )
        winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
        if errorlevel 1 (
            echo [错误] Node.js 自动安装失败。
            echo       请手动到 https://nodejs.org/ 下载 LTS 版安装后，重新运行本脚本。
            echo.
            pause
            exit /b 1
        )
        rem 刷新 PATH，定位 npm（winget 安装的 Node 常见路径）
        if exist "%ProgramFiles%\nodejs\npm.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
        if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
        where npm >nul 2>nul
        if errorlevel 1 (
            echo [提示] Node.js 已安装，但当前窗口未刷新环境变量。
            echo       请关闭本窗口，重新打开 cmd 后再次运行本脚本。
            echo.
            pause
            exit /b 1
        )
    )

    echo [1] 正在通过 npm 全局安装 DSH（@deepseek-ai/dsh），请稍候...
    call npm install -g @deepseek-ai/dsh
    if errorlevel 1 (
        echo.
        echo [错误] DSH 自动安装失败。请手动执行以下任一命令后，重新运行本脚本：
        echo     npm install -g @deepseek-ai/dsh
        echo     国内网络较慢时可改用镜像：npm install -g @deepseek-ai/dsh --registry=https://registry.npmmirror.com
        echo.
        pause
        exit /b 1
    )

    rem 复核安装结果
    where dsh >nul 2>nul
    if errorlevel 1 (
        echo.
        echo [提示] DSH 已安装，但当前窗口尚未识别到 dsh 命令（PATH 未刷新）。
        echo       请关闭本窗口，重新打开 cmd 后再次运行本脚本。
        echo.
        pause
        exit /b 1
    )
    echo      DSH 安装成功，继续安装插件...
    echo.
) else (
    echo     已检测到 DSH，跳过自动安装。
    echo.
)

set "PLUGIN_SRC=%~dp0"
if "%PLUGIN_SRC:~-1%"=="\" set "PLUGIN_SRC=%PLUGIN_SRC:~0,-1%"
set "PROFILE_DIR=%USERPROFILE%\.dsh\profiles\web"
set "TARGET=%PROFILE_DIR%\node_modules\dsh-0-tools"
set "BAK=%TARGET%.bak"

rem ---------- 前置检查：DSH 是否正在运行（运行中直接安装会因端口占用/热加载不生效） ----------
netstat -ano | findstr /R /C:":3080 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
    echo.
    echo [提示] 检测到 dsh web 正在运行（端口 3080 已被占用）。
    echo       继续安装可能导致新插件不生效或端口冲突。
    echo       建议先关闭运行中的 DeepSeek Harness 窗口，再重新运行本脚本。
    choice /C YN /M "仍要继续安装吗？[Y=继续 N=退出]"
    if errorlevel 2 (
        echo 已退出，未做任何改动。
        pause
        exit /b 0
    )
)

echo [1/5] 备份当前已安装的插件（如有）...
if exist "%BAK%" rmdir /S /Q "%BAK%" 2>nul
if exist "%TARGET%" (
    xcopy /E /I /H /Y "%TARGET%" "%BAK%" >nul
    echo      已备份到 %BAK%
) else (
    echo      当前没有已安装版本，跳过备份
)

echo.
echo [2/5] 安装 dsh-0-tools 到 dsh web profile...
rem 优先使用 dsh plugin 命令（会调用 pnpm）；失败则白名单复制插件运行所需文件
rem （v1.5.0：不再整目录复制——旧回退方案会把 .git、screenshots 等无关内容
rem  一并拷进 node_modules，白白占用空间且可能干扰包管理器）
dsh plugin --profile web add "%PLUGIN_SRC%"
if %errorlevel% neq 0 (
    echo      dsh plugin add 失败，改用白名单直接复制...
    rmdir /S /Q "%TARGET%" 2>nul
    mkdir "%TARGET%" 2>nul
    mkdir "%TARGET%\lib" 2>nul
    xcopy /Y "%PLUGIN_SRC%\lib\index.js" "%TARGET%\lib\" >nul
    xcopy /Y "%PLUGIN_SRC%\lib\client.js" "%TARGET%\lib\" >nul
    xcopy /Y "%PLUGIN_SRC%\cordis.patch.yml" "%TARGET%\" >nul
    xcopy /Y "%PLUGIN_SRC%\package.json" "%TARGET%\" >nul
    xcopy /Y "%PLUGIN_SRC%\help.json" "%TARGET%\" >nul
    xcopy /Y "%PLUGIN_SRC%\LICENSE" "%TARGET%\" >nul
    if exist "%PLUGIN_SRC%\README.md" xcopy /Y "%PLUGIN_SRC%\README.md" "%TARGET%\" >nul
    if exist "%PLUGIN_SRC%\README.en.md" xcopy /Y "%PLUGIN_SRC%\README.en.md" "%TARGET%\" >nul
    if exist "%PLUGIN_SRC%\install.bat" xcopy /Y "%PLUGIN_SRC%\install.bat" "%TARGET%\" >nul
)

echo.
echo [3/5] 启动 dsh web（新窗口，保留日志）...
start "dsh web" cmd /c "dsh web"

echo.
echo [4/5] 等待 6 秒后打开浏览器...
timeout /T 6 /NOBREAK >nul
start http://127.0.0.1:3080/

echo.
echo [5/5] 创建桌面快捷方式「DeepSeek Harness」...
set "DESKTOP=%USERPROFILE%\Desktop"
if not exist "%DESKTOP%" if exist "%USERPROFILE%\OneDrive\Desktop" set "DESKTOP=%USERPROFILE%\OneDrive\Desktop"
if not exist "%DESKTOP%" set "DESKTOP=%PUBLIC%\Desktop"
powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('%DESKTOP%\DeepSeek Harness.lnk'); $s.TargetPath='%SystemRoot%\System32\cmd.exe'; $s.Arguments='/k ""dsh web & timeout /t 6 /NOBREAK >nul & start http://127.0.0.1:3080/""'; $s.WorkingDirectory='%USERPROFILE%'; $s.IconLocation='%SystemRoot%\System32\shell32.dll,220'; $s.Description='启动 DeepSeek Harness (dsh web)'; $s.Save()"
if exist "%DESKTOP%\DeepSeek Harness.lnk" (
    echo      已创建桌面快捷方式：「%DESKTOP%\DeepSeek Harness.lnk」
) else (
    echo [警告] 桌面快捷方式创建失败，不影响使用（可从命令行运行 dsh web）
)

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
