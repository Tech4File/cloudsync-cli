; CloudSync-CLI Inno Setup Script
; Build: "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" CloudSync.iss

[Setup]
AppName=CloudSync-CLI
AppVersion=1.0.5
AppPublisher=Tech4File
AppPublisherURL=https://github.com/Tech4File/cloudsync-cli
DefaultDirName={autopf}\CloudSync-CLI
DefaultGroupName=CloudSync-CLI
OutputDir=output
OutputBaseFilename=CloudSync-Setup-1.0.5
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=CloudSync-CLI

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "addtopath"; Description: "Add to PATH (Recommended)"; GroupDescription: "System Integration:"; Flags: checkedonce

[Files]
Source: "cloudsync.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "cloudsync-portable.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\CloudSync-CLI"; Filename: "{app}\cloudsync.exe"
Name: "{group}\Uninstall CloudSync-CLI"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\cloudsync.exe"; Description: "Launch CloudSync-CLI"; Flags: nowait postinstall skipifsilent; Parameters: "--help"

[Registry]
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
    ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; \
    Flags: preservestringtype; Tasks: addtopath; Check: NeedsAddPath('{app}')

[Code]
function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_LOCAL_MACHINE,
    'SYSTEM\CurrentControlSet\Control\Session Manager\Environment',
    'Path', OrigPath) then
  begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + UpperCase(Param) + ';', ';' + UpperCase(OrigPath) + ';') = 0;
end;
