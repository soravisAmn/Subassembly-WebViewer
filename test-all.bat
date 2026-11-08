@echo off
rem Runs all test suites quietly (details: SA.Tests\test-all.js, full log: SA.Tests\test-all.log)
chcp 65001 >nul
cd /d "%~dp0"
node SA.Tests\test-all.js
exit /b %errorlevel%
