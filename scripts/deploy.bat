@echo off
REM TalkToMachine Deployment Script for Windows
setlocal enabledelayedexpansion

echo 🚀 Starting TalkToMachine deployment...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed
    exit /b 1
)

echo [INFO] Installing dependencies...
call npm ci
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)

echo [INFO] Running tests...
call npm test
if errorlevel 1 (
    echo [ERROR] Tests failed
    exit /b 1
)

echo [INFO] Building application...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    exit /b 1
)

set /p deploy="Deploy to production? (y/N): "
if /i "%deploy%"=="y" (
    echo [INFO] Deploying to production...
    REM Add your deployment commands here
    echo [INFO] 🎉 Deployment completed successfully!
) else (
    echo [WARNING] Production deployment skipped
)

pause