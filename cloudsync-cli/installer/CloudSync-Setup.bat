@echo off
setlocal enabledelayedexpansion
title CloudSync-CLI Setup Wizard

set "DEFAULT_DIR=%LOCALAPPDATA%\CloudSync-CLI"
set "REPO=Tech4File/cloudsync-cli"

echo.
echo  ==============================================================
echo            CloudSync-CLI Windows Setup Wizard
echo       Secure Cloud-to-Local Synchronization CLI Suite
echo  ==============================================================
echo.
echo  This wizard will install CloudSync-CLI on your system.
echo.
echo  It will automatically:
echo    1. Install the standalone binary (cloudsync.exe)
echo    2. Register cloudsync globally in your PATH environment variable
echo    3. Verify functionality and command execution
echo.
echo  --------------------------------------------------------------
echo   Step 1: Choose Installation Directory
echo  --------------------------------------------------------------
echo.
echo   [1] Default (Recommended): %DEFAULT_DIR%
echo   [2] Custom Directory
echo   [3] Exit Setup
echo.
set /p DIR_CHOICE="  Enter selection (1-3): "

if "%DIR_CHOICE%"=="3" exit /b 0
if "%DIR_CHOICE%"=="2" goto CUSTOM_DIR
set "INSTALL_DIR=%DEFAULT_DIR%"
goto PROCEED_INSTALL

:CUSTOM_DIR
echo.
set /p USER_DIR="  Enter full custom install path: "
if "%USER_DIR%"=="" (
    set "INSTALL_DIR=%DEFAULT_DIR%"
) else (
    set "INSTALL_DIR=%USER_DIR%"
)

:PROCEED_INSTALL
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [ERROR] Could not create directory: %INSTALL_DIR%
    echo   Please run this installer as Administrator.
    pause
    exit /b 1
)

echo.
echo  --------------------------------------------------------------
echo   Step 2: Installing Executable & Files
echo  --------------------------------------------------------------
echo   Target: %INSTALL_DIR%
echo.

set "SETUP_DIR=%~dp0"
if exist "%SETUP_DIR%cloudsync.exe" (
    copy /Y "%SETUP_DIR%cloudsync.exe" "%INSTALL_DIR%\cloudsync.exe" >nul
    echo   [OK] Copied cloudsync.exe
) else (
    echo   [INFO] Local binary not found, downloading from GitHub Releases...
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/%REPO%/releases/latest/download/cloudsync.exe' -OutFile '%INSTALL_DIR%\cloudsync.exe'"
    if exist "%INSTALL_DIR%\cloudsync.exe" (
        echo   [OK] Downloaded and installed cloudsync.exe
    ) else (
        echo   [ERROR] Failed to download cloudsync.exe
        pause
        exit /b 1
    )
)

:: Create convenient uninstaller script
(
echo @echo off
echo echo.
echo echo   CloudSync-CLI Uninstaller
echo echo   ----------------------------------------
echo set /p CONFIRM="  Are you sure you want to uninstall CloudSync-CLI? (Y/N): "
echo if /i not "%%CONFIRM%%"=="Y" exit /b 0
echo powershell -NoProfile -Command "$p = [Environment]::GetEnvironmentVariable('Path', 'User'); $np = ($p -split ';' | Where-Object { $_ -and $_ -ne '%INSTALL_DIR%' }) -join ';'; [Environment]::SetEnvironmentVariable('Path', $np, 'User')"
echo rmdir /S /Q "%INSTALL_DIR%" 2^>nul
echo echo   [OK] CloudSync-CLI has been uninstalled successfully.
echo pause
) > "%INSTALL_DIR%\uninstall.bat"
echo   [OK] Generated uninstaller: %INSTALL_DIR%\uninstall.bat

echo.
echo  --------------------------------------------------------------
echo   Step 3: Registering Environment Variables (PATH)
echo  --------------------------------------------------------------

:: Use PowerShell to safely update User PATH without setx 1024 char limit
powershell -NoProfile -Command "$dir = '%INSTALL_DIR%'; $p = [Environment]::GetEnvironmentVariable('Path', 'User'); $parts = if ($p) { $p -split ';' } else { @() }; if ($parts -notcontains $dir) { $np = ($parts + $dir | Where-Object { $_ }) -join ';'; [Environment]::SetEnvironmentVariable('Path', $np, 'User'); Write-Host '  [OK] Successfully registered in User PATH' } else { Write-Host '  [INFO] Already registered in User PATH' }"

echo.
echo  ==============================================================
echo                    Installation Complete!
echo  ==============================================================
echo.
echo    Location:     %INSTALL_DIR%
echo    Executable:   %INSTALL_DIR%\cloudsync.exe
echo    Uninstaller:  %INSTALL_DIR%\uninstall.bat
echo.
echo    Verification:
"%INSTALL_DIR%\cloudsync.exe" --version
echo.
echo    Next steps:
echo      1. Open a new terminal / Command Prompt / PowerShell
echo      2. Type: cloudsync --help
echo.
echo  ==============================================================
echo    Press any key to exit wizard...
pause >nul
