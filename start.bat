@echo off
cd /d "%~dp0"
echo.
echo  ============================================================
echo   Vocab Trainer - Server
echo  ============================================================
echo.
echo   1. With User Accounts (Login/Register/Sync)  [port 3001]
echo   2. Static Only (no backend)                   [port 8000]
echo.
set /p choice="  Choose (1 or 2): "

if "%choice%"=="1" goto :auth
if "%choice%"=="2" goto :static
echo   Invalid choice. Defaulting to 1.
goto :auth

:auth
echo.
echo   Starting backend server (Node.js + Express)...
echo   Web: http://localhost:3001
echo   API:  http://localhost:3001/api
echo.
cd /d "%~dp0\server"
call npm install
node server.js
goto :done

:static
echo.
echo   Starting static server (Python)...
echo   Web: http://localhost:8000
echo   (No login/register — progress saved locally only)
echo.
set "PY=C:\Users\HP\AppData\Local\Programs\Python\Python314\python.exe"
if exist "%PY%" (
    "%PY%" -m http.server 8000
    goto :done
)
where py >nul 2>nul && ( py -m http.server 8000 & goto :done )
where python >nul 2>nul && ( python -m http.server 8000 & goto :done )
echo [ERROR] Not found Python - install from https://www.python.org

:done
echo.
echo Server stopped.
pause