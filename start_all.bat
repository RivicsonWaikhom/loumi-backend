@echo off
echo ========================================================
echo  Starting Loumi AI Backend and Frontend...
echo ========================================================
start "Loumi Backend (FastAPI)" cmd /k "%~dp0run_backend.bat"
timeout /t 3 /nobreak >nul
start "Loumi Frontend (Vite)" cmd /k "%~dp0run_frontend.bat"
