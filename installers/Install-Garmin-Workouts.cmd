@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer from https://nodejs.org, then open this installer again.
  pause
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major>22 ? 0 : major===22 ? (minor>=12 ? 0 : 1) : 1)"
if errorlevel 1 (
  echo Node.js 22.12 or newer is required. Update Node from https://nodejs.org.
  pause
  exit /b 1
)
if "%~1"=="--check" (
  node "%~dp0..\dist\cli.js" --version
  exit /b
)
node "%~dp0..\dist\cli.js" install-plugin
if errorlevel 1 (
  echo Installation did not complete. Your existing plugins have been preserved.
  pause
  exit /b 1
)
pause
