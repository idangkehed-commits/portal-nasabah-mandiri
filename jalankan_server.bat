@echo off
title Server Web Portal Nasabah
cd /d "%~dp0"
echo ======================================================================
echo   SERVER WEB PORTAL DATA NASABAH (KUR & KUM MANDIRI)
echo ======================================================================
echo.
echo Membuka browser...
start http://localhost:3000
echo.
node server.js
pause
