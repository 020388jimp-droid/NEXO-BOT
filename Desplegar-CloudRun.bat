@echo off
setlocal
cd /d "%~dp0"

if not exist .env (
  echo Falta el archivo .env.
  echo Copia .env.example a .env y agrega tu GEMINI_API_KEY.
  pause
  exit /b 1
)

node scripts/desplegar.js
if errorlevel 1 (
  echo.
  echo El despliegue no termino correctamente.
  pause
)
