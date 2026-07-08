@echo off
setlocal enabledelayedexpansion
title CloudSync-CLI Setup

set "VERSION=1.0.5"
set "DEFAULT_DIR=%LOCALAPPDATA%\CloudSync-CLI"

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║        CloudSync-CLI v%VERSION% Installer            ║
echo  ║   Secure cloud-to-local file synchronization        ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  This wizard will install CloudSync-CLI on your computer.
echo.
echo  It will:
echo    * Copy the executable to your chosen location
echo    * Register the cloudsync command globally
echo    * Add the installation directory to your PATH
echo.
echo  ─────────────────────────────────────────────────────
echo   Step 1 of 3: Installation Directory
echo  ─────────────────────────────────────────────────────
echo.
echo   Where should CloudSync-CLI be installed?
echo.
echo   [1] Default: %DEFAULT_DIR%
echo   [2] Custom path
echo   [3] Exit installer
echo.
set /p DIR_CHOICE="  Enter choice (1-3): "

if "%DIR_CHOICE%"=="3" exit /b 0
if "%DIR_CHOICE%"=="2" goto CUSTOM_DIR
set "INSTALL_DIR=%DEFAULT_DIR%"
goto CONFIRM_DIR

:CUSTOM_DIR
echo.
set /p INSTALL_DIR="  Enter full installation path: "
if "%INSTALL_DIR%"=="" set "INSTALL_DIR=%DEFAULT_DIR%"

:CONFIRM_DIR
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Could not create: %INSTALL_DIR%
    echo   Try running as Administrator.
    pause
    exit /b 1
)
echo   Installing to: %INSTALL_DIR%

echo.
echo  ─────────────────────────────────────────────────────
echo   Step 2 of 3: Installing Files
echo  ─────────────────────────────────────────────────────
echo.

set "SETUP_DIR=%~dp0"
if exist "%SETUP_DIR%cloudsync.exe" (
    copy /Y "%SETUP_DIR%cloudsync.exe" "%INSTALL_DIR%\cloudsync.exe" >nul 2>&1
    echo   [OK] cloudsync.exe
) else (
    echo   [SKIP] cloudsync.exe not found in setup directory
)

if exist "%SETUP_DIR%cloudsync-portable.exe" (
    copy /Y "%SETUP_DIR%cloudsync-portable.exe" "%INSTALL_DIR%\cloudsync-portable.exe" >nul 2>&1
    echo   [OK] cloudsync-portable.exe
)

echo @echo off > "%INSTALL_DIR%\cloudsync.bat"
echo "%%INSTALL_DIR%%\cloudsync.exe" %%* >> "%INSTALL_DIR%\cloudsync.bat"
echo   [OK] cloudsync command wrapper

(
echo CloudSync-CLI v%VERSION%
echo Installed: %DATE% %TIME%
echo Path: %INSTALL_DIR%
echo Docs: https://github.com/Tech4File/cloudsync-cli
) > "%INSTALL_DIR%\VERSION.txt"
echo   [OK] VERSION.txt

(
echo @echo off
echo echo.
echo echo   CloudSync-CLI Uninstaller
echo echo   ────────────────────────
echo choice /c YN /n /m "  Uninstall? [Y/N] "
echo if errorlevel 2 exit /b 0
echo rmdir /S /Q "%INSTALL_DIR%" 2^>nul
echo echo   CloudSync-CLI has been uninstalled.
echo echo   Remove from PATH: %INSTALL_DIR%
echo pause
) > "%INSTALL_DIR%\uninstall.bat"
echo   [OK] Uninstaller

echo.
echo  ─────────────────────────────────────────────────────
echo   Step 3 of 3: System Integration
echo  ─────────────────────────────────────────────────────
echo.

setx PATH "%PATH%;%INSTALL_DIR%" >nul 2>&1
if errorlevel 1 (
    echo   [WARN] Could not update PATH automatically.
    echo   Add manually: %INSTALL_DIR%
) else (
    echo   [OK] Added to user PATH
)

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║          Installation Complete!                      ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo    Location:    %INSTALL_DIR%
echo    Uninstall:   %INSTALL_DIR%\uninstall.bat
echo.
echo    To get started:
echo      1. Open a NEW terminal window
echo      2. Run: cloudsync --version
echo      3. Run: cloudsync --help
echo.
echo    Full documentation:
echo    https://github.com/Tech4File/cloudsync-cli#readme
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  Press any key to close...                          ║
echo  ╚══════════════════════════════════════════════════════╝
pause >nul
