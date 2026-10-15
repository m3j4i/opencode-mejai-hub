@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Criar-atalho.ps1"
if errorlevel 1 pause
