@echo off
cd /d "%~dp0"
echo Starting Subassembly Viewer at http://localhost:5050 ...
echo Put subassembly .cs files in: %~dp0
echo (keep this window open; press Ctrl+C to stop)
dotnet watch --project SA.Web
pause
