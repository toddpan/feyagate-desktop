@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: FeyaGate Desktop — 启动脚本 (Windows)

set "APP_NAME=FeyaGate Desktop"
set "EXE_NAME=FeyaGate Desktop.exe"
set "PROCESS_NAME=miloco-mcp-server"

:: Check if already running
tasklist /FI "IMAGENAME eq %EXE_NAME%" /FO CSV /NH 2>nul | findstr /I "%EXE_NAME%" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [INFO] %APP_NAME% 已在运行中
    goto :end
)

:: Try common installation paths
set "APP_PATH="
for %%P in (
    "%LOCALAPPDATA%\Programs\%APP_NAME%\%EXE_NAME%"
    "%ProgramFiles%\%APP_NAME%\%EXE_NAME%"
    "%ProgramFiles(x86)%\%APP_NAME%\%EXE_NAME%"
    "%USERPROFILE%\Desktop\%EXE_NAME%"
) do (
    if exist %%~P (
        set "APP_PATH=%%~P"
        goto :found
    )
)

echo [ERROR] 未找到 %APP_NAME%，请先安装
echo   默认安装路径: %LOCALAPPDATA%\Programs\%APP_NAME%\
goto :end

:found
echo [INFO] 启动 %APP_NAME%...
start "" "%APP_PATH%"

timeout /t 3 /nobreak >nul

tasklist /FI "IMAGENAME eq %EXE_NAME%" /FO CSV /NH 2>nul | findstr /I "%EXE_NAME%" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] %APP_NAME% 启动成功
) else (
    echo [WARN] %APP_NAME% 可能未成功启动，请检查日志
)

:end
endlocal
