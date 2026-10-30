@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 goto :error
)

if not exist .env (
  copy .env.example .env >nul
  echo.
  echo Se creo .env a partir de .env.example.
  echo Agrega tu GEMINI_API_KEY para activar la IA.
  echo.
)

start "" /min cmd /c "timeout /t 4 >nul && start http://localhost:8080/demo"
call npm start
goto :eof

:error
echo.
echo No se pudieron instalar las dependencias.
pause
