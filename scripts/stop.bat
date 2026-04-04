@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: FeyaGate Desktop — 关闭脚本 (Windows)

set "APP_NAME=FeyaGate Desktop"
set "EXE_NAME=FeyaGate Desktop.exe"
set "PROCESS_NAME=miloco-mcp-server"
set "WAIT_TIMEOUT=10"

echo [INFO] 正在关闭 %APP_NAME%...

:: 1) Gracefully terminate Electron process
tasklist /FI "IMAGENAME eq %EXE_NAME%" /FO CSV /NH 2>nul | findstr /I "%EXE_NAME%" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    taskkill /IM "%EXE_NAME%" >nul 2>&1
    echo [INFO] 已发送关闭信号给 %APP_NAME%
) else (
    echo [INFO] %APP_NAME% 未运行
)

:: 2) Wait for graceful shutdown
set WAITED=0
:wait_loop
if %WAITED% geq %WAIT_TIMEOUT% goto :force_kill

tasklist /FI "IMAGENAME eq %EXE_NAME%" /FO CSV /NH 2>nul | findstr /I "%EXE_NAME%" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    tasklist /FI "IMAGENAME eq %PROCESS_NAME%.exe" /FO CSV /NH 2>nul | findstr /I "%PROCESS_NAME%" >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [OK] %APP_NAME% 已完全关闭
        goto :end
    )
)

timeout /t 1 /nobreak >nul
set /a WAITED+=1
goto :wait_loop

:force_kill
echo [WARN] 等待超时，强制终止残留进程...

:: Force kill MCP server
tasklist /FI "IMAGENAME eq %PROCESS_NAME%.exe" /FO CSV /NH 2>nul | findstr /I "%PROCESS_NAME%" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [INFO] 终止 MCP Server 进程
    taskkill /F /IM "%PROCESS_NAME%.exe" >nul 2>&1
)

:: Force kill Electron
tasklist /FI "IMAGENAME eq %EXE_NAME%" /FO CSV /NH 2>nul | findstr /I "%EXE_NAME%" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [INFO] 终止 Electron 进程
    taskkill /F /IM "%EXE_NAME%" >nul 2>&1
)

timeout /t 1 /nobreak >nul

tasklist /FI "IMAGENAME eq %EXE_NAME%" /FO CSV /NH 2>nul | findstr /I "%EXE_NAME%" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [ERROR] 仍有残留进程，请手动检查: tasklist ^| findstr "%APP_NAME%"
) else (
    echo [OK] 所有进程已终止
)

:end
endlocal
