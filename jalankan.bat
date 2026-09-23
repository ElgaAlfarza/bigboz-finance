@echo off
title BigBoz Finance - Local Server
echo.
echo ╔══════════════════════════════════════════════╗
echo ║         BigBoz Finance App Launcher          ║
echo ║    http://localhost:8888  →  buka di Chrome  ║
echo ╚══════════════════════════════════════════════╝
echo.
echo Membuka Chrome otomatis...
timeout /t 2 /nobreak >nul
start "" "chrome" "http://localhost:8888" 2>nul || start "" "msedge" "http://localhost:8888"
echo.
echo Server berjalan di http://localhost:8888
echo Tekan Ctrl+C untuk berhenti.
echo.
python -m http.server 8888
