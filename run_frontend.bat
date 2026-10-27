@echo off
echo ========================================================
echo  Starting Loumi AI Website Frontend (Vite on Port 5173)...
echo ========================================================
cd /d "%~dp0project"
call npm.cmd run dev
pause
