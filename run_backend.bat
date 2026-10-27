@echo off
echo ========================================================
echo  Starting Loumi AI Backend (FastAPI on Port 8000)...
echo ========================================================
cd /d "E:\projects\WebApp\LoumiPrototype01\Loumi"
call .\venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause
