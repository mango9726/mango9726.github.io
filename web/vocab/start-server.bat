@echo off
cd /d "%~dp0"
echo.
echo  ============================================================
echo   Vocab Trainer - Local Server
echo   เปิดเว็บที่:  http://localhost:8000  (ใน Chrome หรือ Edge)
echo   กดอนุญาตไมโครโฟนครั้งแรกครั้งเดียว พร้อมใช้งานตลอด
echo   ปิดหน้าต่างนี้ (หรือกด Ctrl+C) เมื่อเลิกใช้
echo  ============================================================
echo.

set "PY=C:\Users\HP\AppData\Local\Programs\Python\Python314\python.exe"

if exist "%PY%" (
    "%PY%" -m http.server 8000
    goto :done
)

REM สำรอง: ลองจาก PATH
where py >nul 2>nul && ( py -m http.server 8000 & goto :done )
where python >nul 2>nul && ( python -m http.server 8000 & goto :done )

echo [ERROR] ไม่พบ Python - ติดตั้งจาก https://www.python.org แล้วลองใหม่
:done
echo.
echo เซิร์ฟเวอร์หยุดทำงานแล้ว
pause
