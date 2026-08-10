@echo off
setlocal
cd /d "%~dp0"
py -3 GENERAR_WEB_PRODUCCION_SEGURA.py 2>nul || python GENERAR_WEB_PRODUCCION_SEGURA.py
pause
