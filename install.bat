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

rem ---------- 版本检查：装之前先告诉用户这是不是最新版 ----------
rem 解决"用户装到旧版"的核心问题：脚本本身不下载任何东西，
rem 它装的是"脚本自己所在目录"的版本，所以先本地报出实际版本。
rem 用 PowerShell 而非 for/findstr 解析JSON —— 后者遇中文路径与引号易出错。
set "LOCAL_VER=unknown"
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; if (Test-Path '%~dp0package.json') { (Get-Content '%~dp0package.json' -Raw | ConvertFrom-Json).version }"`) do set "LOCAL_VER=%%v"
if "!LOCAL_VER!"=="" set "LOCAL_VER=unknown"
echo [版本] 本地源码版本：v!LOCAL_VER!
echo.

rem 尝试获取远程最新版（GitHub 优先，不通则回落 Gitee；均失败不影响安装）
set "REMOTE_VER="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; foreach ($u in @('https://raw.githubusercontent.com/ai-yukin/dsh-0-tools/main/package.json','https://gitee.com/ai-yukin/dsh-0-tools/raw/main/package.json')) { try { $c=(Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 8).Content; $j=$c|ConvertFrom-Json; if ($j.version) { $j.version; break } } catch {} }"`) do if not defined REMOTE_VER set "REMOTE_VER=%%v"

if defined REMOTE_VER (
    if "!LOCAL_VER!"=="!REMOTE_VER!" (
        echo [版本] ✅ 你安装的是最新版 v!LOCAL_VER!
    ) else (
        echo [版本] ⚠️  本地是 v!LOCAL_VER!，但远程最新是 v!REMOTE_VER!
        echo.
        echo        你的版本不是最新。建议先更新源码再重新运行本脚本：
        echo          cd /d "%~dp0"
        echo          git pull origin main
        echo.
        echo        （国内网络可改用镜像：git pull gitee main）
        echo.
    )
) else (
    echo [版本] 未能获取远程版本号（网络不通），跳过版本比对。
    echo        若怀疑版本过旧，可到 GitHub/Gitee 仓库页确认最新版本号。
)
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

rem ============================================================
rem 版本兼容性闸门
rem v1.11.0 起本插件同时支持 DSH 0.1.5~ 0.1.x 与 0.2.x
rem （peerDependencies 声明为 "@deepseek-ai/dsh": ">=0.1.5 <0.3"）。
rem 这里只拦 0.3 及以上——那一代尚未验证，装上去大概率加载不了。
rem ============================================================
set "DSH_VER_OK="
for /f "delims=" %%v in ('dsh --version 2^>nul') do (
    if not defined DSH_VER_OK set "DSH_VER_OK=%%v"
)
if not defined DSH_VER_OK (
    echo [3/5] 未能读取 DSH 版本（可能 PATH 未刷新），跳过版本校验。
    echo.
) else (
    echo [3/5] 检测到 DSH 版本：%DSH_VER_OK%
    echo %DSH_VER_OK% | findstr /r /c:"^0\.[3-9]\." /c:"^[1-9]\." >nul
    if not errorlevel 1 (
        echo.
        echo [错误] 你安装的是 DSH %DSH_VER_OK%，本插件尚未验证支持该版本。
        echo.
        echo   本插件当前支持范围：DSH 0.1.5 ~ 0.2.x
        echo   DSH 0.3 起可能存在不兼容改动，本插件暂不承诺支持。
        echo.
        echo   解决办法（二选一）：
        echo     [推荐] 改用已验证的版本：
        echo             npm install -g @deepseek-ai/dsh@0.1.7-rc.2
        echo       国内网络慢可用镜像：
        echo             npm install -g @deepseek-ai/dsh@0.1.7-rc.2 --registry=https://registry.npmmirror.com
        echo     [或] 等待本插件发布支持新版本的更新。
        echo.
        pause
        exit /b 1
    )
    echo       ✅ 版本兼容（支持 0.1.5 ~ 0.2.x），继续安装插件...
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
echo [4/5] 等待 DSH 启动并打开浏览器...
rem v1.10.0修正：DSH 0.1.7 起启用 web 认证，直接开 http://127.0.0.1:3080/
rem 会返回 401 打不开页面。dsh web 启动时会在新窗口打印带 ?token= 的
rem 真实可访问地址，由 DSH 自己负责打开。
rem 这里改为等待并提示，不再强开无 token 的裸地址。
timeout /T 8 /NOBREAK >nul
echo.
echo   DSH 已在���窗口启动。若浏览器没有自动打开，请在该窗口中
echo   复制打印出来的、含 ?token= 的完整地址到浏览器打开。
echo   （DSH 0.1.7 起需要这个 token 才能访问，直接开 127.0.0.1:3080 会显示 401）
echo.

echo.
echo [5/5] 创建桌面快捷方式「DeepSeek Harness」...
set "DESKTOP=%USERPROFILE%\Desktop"
if not exist "%DESKTOP%" if exist "%USERPROFILE%\OneDrive\Desktop" set "DESKTOP=%USERPROFILE%\OneDrive\Desktop"
if not exist "%DESKTOP%" set "DESKTOP=%PUBLIC%\Desktop"
rem v1.10.0：去掉原来的 start http://127.0.0.1:3080/ ——
rem DSH 0.1.7 起该地址返回 401，改为只启动 dsh web，由它自己打开
rem 带 ?token= 的可访问地址。
powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('%DESKTOP%\DeepSeek Harness.lnk'); $s.TargetPath='%SystemRoot%\System32\cmd.exe'; $s.Arguments='/k ""dsh web""'; $s.WorkingDirectory='%USERPROFILE%'; $s.IconLocation='%SystemRoot%\System32\shell32.dll,220'; $s.Description='启动 DeepSeek Harness (dsh web)'; $s.Save()"
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
echo ⚠️ DSH 0.1.7 起网页需要认证：若浏览器打开后显示 401 或空白页，
echo    请到「dsh web」启动窗口复制含 ?token= 的完整地址重新打开。
echo.
echo 如需卸载：
echo   dsh plugin --profile web remove dsh-0-tools
echo 如需回退旧版，在 PowerShell/cmd 里执行：
echo   rmdir /S /Q "%TARGET%" ^&^& xcopy /E /I /H /Y "%BAK%" "%TARGET%"
echo.
pause
