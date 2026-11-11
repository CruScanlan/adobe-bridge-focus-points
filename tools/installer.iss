; Inno Setup script: FocusPointsSetup-v<version>.exe
;
;   bash tools/build-release.sh            (fills dist/extension)
;   iscc /DAppVersion=1.2.3 tools\installer.iss
;
; Per-user, no admin prompt. The extension folder must hold exactly the files
; of the signed package (Bridge rejects it otherwise), so the folder is emptied
; before copying and the uninstaller is kept outside it.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{6B0E1E0C-6C1D-4C0B-9D53-5E1B7B1F0A51}
AppName=Bridge Focus Points
AppVersion={#AppVersion}
AppPublisher=Cru Scanlan
AppPublisherURL=https://github.com/CruScanlan/adobe-bridge-focus-points
DefaultDirName={userappdata}\Adobe\CEP\extensions\com.cru.bridgefocuspoints
UninstallFilesDir={localappdata}\BridgeFocusPoints
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=FocusPointsSetup-v{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
LicenseFile=..\LICENSE

[InstallDelete]
Type: filesandordirs; Name: "{app}\*"

[Files]
Source: "..\dist\extension\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
Type: dirifempty; Name: "{localappdata}\BridgeFocusPoints"

[Messages]
FinishedLabelNoIcons=Focus Points is installed.%n%nRestart Bridge, then open Window > Extensions > Focus Points.

[Code]
function BridgeIsRunning(): Boolean;
var
  Locator, Service, Found: Variant;
begin
  Result := False;
  try
    Locator := CreateOleObject('WbemScripting.SWbemLocator');
    Service := Locator.ConnectServer('', 'root\CIMV2', '', '');
    Found := Service.ExecQuery('SELECT Name FROM Win32_Process WHERE Name = "Adobe Bridge.exe"');
    Result := (Found.Count > 0);
  except
  end;
end;

// Bridge keeps the extension's files open while the panel runs, so they
// cannot be replaced (or removed) until it is closed.
function WaitForBridgeToClose(): Boolean;
begin
  Result := True;
  while BridgeIsRunning() do
    if MsgBox('Adobe Bridge is running. Close it, then click OK to continue.',
              mbInformation, MB_OKCANCEL) = IDCANCEL then
    begin
      Result := False;
      Exit;
    end;
end;

function InitializeSetup(): Boolean;
begin
  Result := WaitForBridgeToClose();
end;

function InitializeUninstall(): Boolean;
begin
  Result := WaitForBridgeToClose();
end;
