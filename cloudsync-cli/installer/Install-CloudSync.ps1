# CloudSync-CLI Automated Installer for Windows PowerShell
# Usage: irm https://raw.githubusercontent.com/Tech4File/cloudsync-cli/main/installer/Install-CloudSync.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo = "Tech4File/cloudsync-cli"
$InstallDir = "$HOME\.cloudsync\bin"
$Executable = "$InstallDir\cloudsync.exe"
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/cloudsync.exe"

Write-Host "`n🔒 CloudSync-CLI Windows Installer" -ForegroundColor Cyan
Write-Host ("━" * 60) -ForegroundColor Gray

if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Write-Host "📥 Downloading cloudsync.exe from latest release..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $DownloadUrl -OutFile $Executable

Write-Host "✅ Binary installed to: $Executable" -ForegroundColor Green

# Add to User PATH if not already present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    $env:Path = "$env:Path;$InstallDir"
    Write-Host "📝 Added $InstallDir to User PATH environment variable." -ForegroundColor Cyan
}

Write-Host ("━" * 60) -ForegroundColor Gray
Write-Host "🎉 CloudSync-CLI installed successfully!" -ForegroundColor Green
Write-Host "🚀 Run 'cloudsync --help' in a new terminal window to get started.`n" -ForegroundColor White
