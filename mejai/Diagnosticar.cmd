@echo off
cd /d "%~dp0"
"%~dp0runtime\node\node.exe" "%~dp0diagnostico-local.mjs"
echo.
pause
