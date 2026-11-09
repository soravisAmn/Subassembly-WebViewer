@echo off
rem Builds tests-civil3d\build\out\SaRound6.dll against the installed Civil 3D (short summary only)
chcp 65001 >nul
cd /d "%~dp0"
node tests-civil3d\build\build.js
exit /b %errorlevel%
