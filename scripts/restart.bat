@echo off
chcp 65001 >nul 2>&1

:: FeyaGate Desktop — 重启脚本 (Windows)

echo =========================================
echo   FeyaGate Desktop 重启
echo =========================================

echo.
echo [1/2] 关闭应用...
call "%~dp0stop.bat"

echo.
echo [2/2] 启动应用...
timeout /t 2 /nobreak >nul
call "%~dp0start.bat"

echo.
echo =========================================
echo   重启完成
echo =========================================
