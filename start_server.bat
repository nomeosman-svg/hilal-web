@echo off
cd /d "%~dp0"
wscript.exe start_service.vbs
timeout /t 3 /nobreak >nul
node bin\status.js
pause
