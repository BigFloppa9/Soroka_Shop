@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "LOG=%~dp0start-log.txt"
echo ==== Soroka store: run started %date% %time% ==== > "%LOG%"

echo ============================================
echo   Soroka store - setup and start
echo ============================================
echo.
echo Full log is saved to start-log.txt next to this file.
echo Using a portable copy of Node.js - nothing is installed
echo system-wide, no administrator rights needed.
echo.

set "NODE_DIR=%~dp0node-portable"
set "NODE_VERSION=v22.11.0"

echo [1] checking for local portable Node.js >> "%LOG%"
if exist "%NODE_DIR%\node.exe" (
  echo [1] found local copy >> "%LOG%"
  goto :have_node
)

echo [1] not found locally, will download >> "%LOG%"
echo Downloading portable Node.js, please wait...

if exist "%NODE_DIR%" (
  echo [1] removing incomplete folder >> "%LOG%"
  rmdir /s /q "%NODE_DIR%" >> "%LOG%" 2>&1
)

set "NODE_ZIP=%TEMP%\node-portable-%RANDOM%.zip"
set "NODE_EXTRACT=%TEMP%\node-extract-%RANDOM%"

echo [2] downloading zip from nodejs.org >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-x64.zip' -OutFile '%NODE_ZIP%'" >> "%LOG%" 2>&1
echo [2] download command finished >> "%LOG%"

if not exist "%NODE_ZIP%" (
  echo.
  echo Could not download Node.js. Check your internet connection
  echo and run start.bat again. See start-log.txt for details.
  pause
  exit /b 1
)
echo [2] zip file confirmed on disk >> "%LOG%"

echo Extracting...
echo [3] extracting zip >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%NODE_EXTRACT%' -Force" >> "%LOG%" 2>&1
echo [3] extract command finished >> "%LOG%"

echo [4] moving extracted folder into place >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d = Get-ChildItem '%NODE_EXTRACT%' -Directory | Select-Object -First 1; Move-Item $d.FullName '%NODE_DIR%' -Force" >> "%LOG%" 2>&1
echo [4] move command finished >> "%LOG%"

if not exist "%NODE_DIR%\node.exe" (
  echo.
  echo Could not prepare Node.js. See start-log.txt for details.
  pause
  exit /b 1
)

del /q "%NODE_ZIP%" >nul 2>nul
rmdir /s /q "%NODE_EXTRACT%" >nul 2>nul
echo [4] portable Node.js ready >> "%LOG%"
echo Done.
echo.

:have_node
set "PATH=%NODE_DIR%;%PATH%"
echo [5] PATH updated, checking versions >> "%LOG%"
echo Node.js version:
"%NODE_DIR%\node.exe" -v
"%NODE_DIR%\node.exe" -v >> "%LOG%" 2>&1
echo [5] node -v done >> "%LOG%"
call "%NODE_DIR%\npm.cmd" -v
call "%NODE_DIR%\npm.cmd" -v >> "%LOG%" 2>&1
echo [5] npm -v done >> "%LOG%"
echo.

echo [6] checking node_modules folder >> "%LOG%"
if not exist "node_modules" (
  echo Installing project dependencies, this can take a minute or two...
  echo [6] running npm install >> "%LOG%"
  call "%NODE_DIR%\npm.cmd" install >> "%LOG%" 2>&1
  echo [6] npm install finished, errorlevel=!errorlevel! >> "%LOG%"
  if !errorlevel! neq 0 (
    echo.
    echo Failed to install dependencies. See start-log.txt for the full error.
    pause
    exit /b 1
  )
  echo Done.
) else (
  echo Dependencies already installed, skipping this step.
)
echo.

echo [7] checking database file >> "%LOG%"
if not exist "server\data.sqlite" (
  echo Filling the database with sample products...
  echo [7] running npm run seed >> "%LOG%"
  call "%NODE_DIR%\npm.cmd" run seed >> "%LOG%" 2>&1
  echo [7] seed finished, errorlevel=!errorlevel! >> "%LOG%"
  if !errorlevel! neq 0 (
    echo.
    echo Failed to create the database. See start-log.txt for details.
    pause
    exit /b 1
  )
  echo Done.
  echo.
) else (
  echo Database already exists, skipping this step.
  echo.
)

echo [8] launching server window >> "%LOG%"
echo Starting the server...
if exist "server\.port" del /q "server\.port" >nul 2>nul
start "Soroka store server - keep this window open" cmd /k "restart-loop.bat"

set "APP_PORT=3000"
for /l %%i in (1,1,20) do (
  if exist "server\.port" goto :port_ready
  timeout /t 1 /nobreak >nul
)
:port_ready
if exist "server\.port" (
  set /p APP_PORT=<"server\.port"
)

start "" http://localhost:!APP_PORT!
echo [8] server window launched, browser opened >> "%LOG%"

echo.
echo Done! The store opened in your browser: http://localhost:!APP_PORT!
echo Admin panel: http://localhost:!APP_PORT!/admin
echo.
echo To stop the store, close the separate server log window.
echo This window will close itself in a few seconds.
echo [9] main script finished normally >> "%LOG%"
timeout /t 5 /nobreak >nul
exit /b 0
