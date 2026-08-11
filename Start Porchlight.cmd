@echo off
title Porchlight
cd /d "%~dp0porchlight"

rem Already running? Just open the browser.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 1 }"
if errorlevel 1 (
  echo Porchlight is already running.
  start "" http://localhost:3000
  exit /b 0
)

rem First run (or after 'rd /s /q .next'): build the production bundle.
if not exist ".next\BUILD_ID" (
  echo Building Porchlight - first run takes about a minute...
  call npm run build
  if errorlevel 1 (
    echo.
    echo Build failed - see the errors above.
    pause
    exit /b 1
  )
)

echo.
echo  Porchlight is starting at http://localhost:3000
echo  Leave this window open while you use the app.
echo  (If the app looks out of date after code changes, close this,
echo   delete the porchlight\.next folder, and run this again.)
echo.
start "" http://localhost:3000
call npm start
