@echo off
cd /d "%~dp0"
echo ========================================================
echo   ACTUALIZANDO Y SUBIENDO A GITHUB (checklist-iapser)
echo ========================================================
git add .
git commit -m "Portal de Legajo Digital HyS, actividades y subida codificada a Drive"
git push -u origin main
echo.
echo ========================================================
echo   Subida completada.
echo ========================================================
echo Presiona cualquier tecla para salir...
pause
