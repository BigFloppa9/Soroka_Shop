@echo off
cd /d "%~dp0"

:loop
call npm start
if %errorlevel%==0 (
  echo.
  echo Server exited cleanly, restarting...
  echo.
  goto loop
)

echo.
echo Server stopped (exit code %errorlevel%).
pause
