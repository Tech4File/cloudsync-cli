# CloudSync-CLI Universal Installer for Windows PowerShell
# Usage:
#   Install:   irm https://raw.githubusercontent.com/Tech4File/cloudsync-cli/main/installer/Install-CloudSync.ps1 | iex
#   Custom:    & .\Install-CloudSync.ps1 -InstallDir "C:\Tools\cloudsync"
#   Uninstall: & .\Install-CloudSync.ps1 -Uninstall

param(
    [string]$InstallDir = "$HOME\.cloudsync\bin",
    [string]$Version = "latest",
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$Repo = "Tech4File/cloudsync-cli"
$Executable = Join-Path $InstallDir "cloudsync.exe"

Write-Host "`n🔒 CloudSync-CLI Windows Installer" -ForegroundColor Cyan
Write-Host ("━" * 60) -ForegroundColor Gray

# ─────────────────────────────────────────────────────────────
# UNINSTALL MODE
# ─────────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Host "🗑️  Uninstalling CloudSync-CLI..." -ForegroundColor Yellow
    if (Test-Path $InstallDir) {
        Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✅ Removed installation directory: $InstallDir" -ForegroundColor Green
    }
    
    # Remove from User PATH
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($UserPath -like "*$InstallDir*") {
        $CleanPath = ($UserPath -split ';' | Where-Object { $_ -and $_ -ne $InstallDir }) -join ';'
        [Environment]::SetEnvironmentVariable("Path", $CleanPath, "User")
        Write-Host "📝 Removed $InstallDir from User PATH environment variable." -ForegroundColor Cyan
    }
    
    Write-Host ("━" * 60) -ForegroundColor Gray
    Write-Host "🎉 CloudSync-CLI has been cleanly uninstalled.`n" -ForegroundColor Green
    exit 0
}

# ─────────────────────────────────────────────────────────────
# INSTALLATION MODE
# ─────────────────────────────────────────────────────────────
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$DownloadUrl = if ($Version -eq "latest") {
    "https://github.com/$Repo/releases/latest/download/cloudsync.exe"
} else {
    "https://github.com/$Repo/releases/download/v$Version/cloudsync.exe"
}

Write-Host "📦 Target Directory: $InstallDir" -ForegroundColor White
Write-Host "📥 Downloading cloudsync.exe from $DownloadUrl..." -ForegroundColor Yellow

try {
    # Use TLS 1.2+ for secure downloads
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $Executable -UseBasicParsing
} catch {
    Write-Host "❌ Download failed: $_" -ForegroundColor Red
    Write-Host "   Check your internet connection or verify release availability at https://github.com/$Repo/releases" -ForegroundColor Gray
    exit 1
}

if (!(Test-Path $Executable)) {
    Write-Host "❌ Failed to install cloudsync.exe" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Binary installed to: $Executable" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────
# ENVIRONMENT VARIABLES & GLOBAL PATH RECOGNITION
# ─────────────────────────────────────────────────────────────
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$PathParts = if ($UserPath) { $UserPath -split ';' } else { @() }

if ($PathParts -notcontains $InstallDir) {
    $NewPath = ($PathParts + $InstallDir | Where-Object { $_ }) -join ';'
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path = "$env:Path;$InstallDir"
    Write-Host "📝 Added $InstallDir to User PATH environment variable (Globally Recognized)." -ForegroundColor Cyan
} else {
    Write-Host "ℹ️  $InstallDir is already registered in User PATH." -ForegroundColor Gray
}

# ─────────────────────────────────────────────────────────────
# FUNCTIONALITY & EXECUTION VERIFICATION
# ─────────────────────────────────────────────────────────────
Write-Host "🔍 Verifying installation..." -ForegroundColor Yellow
try {
    $VerOutput = & "$Executable" --version
    Write-Host "✅ Verified CloudSync-CLI version: $VerOutput" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Executable installed but verification encountered a warning: $_" -ForegroundColor Yellow
}

Write-Host ("━" * 60) -ForegroundColor Gray
Write-Host "🎉 CloudSync-CLI installed successfully!" -ForegroundColor Green
Write-Host "🚀 Run 'cloudsync --help' in your terminal to get started.`n" -ForegroundColor White
