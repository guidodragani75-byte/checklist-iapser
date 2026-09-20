@echo off
cd /d "%~dp0"
echo ========================================================
echo   SUBIENDO PROYECTO A GITHUB (checklist-iapser)
echo ========================================================
git push -u origin main
echo.
echo Presiona cualquier tecla para salir...
pause
