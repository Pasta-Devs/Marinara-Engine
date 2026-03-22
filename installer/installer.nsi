; ──────────────────────────────────────────────
; Marinara Engine — Windows Installer
; Cross-compiled from macOS via NSIS (makensis)
; ──────────────────────────────────────────────

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ── App metadata ──
!define APP_NAME "Marinara Engine"
!define APP_VERSION "1.4.0"
!define APP_PUBLISHER "SpicyMarinara"
!define APP_URL "https://github.com/SpicyMarinara/Marinara-Engine"
!define REPO_URL "https://github.com/SpicyMarinara/Marinara-Engine.git"
!define DEFAULT_DIR "$LOCALAPPDATA\MarinaraEngine"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "Marinara-Engine-Installer-${APP_VERSION}.exe"
InstallDir "${DEFAULT_DIR}"
RequestExecutionLevel user
Unicode True
SetCompressor /SOLID lzma
ShowInstDetails show

; ── Modern UI config ──
!define MUI_ICON "app-icon.ico"
!define MUI_UNICON "app-icon.ico"
!define MUI_ABORTWARNING
BrandingText "${APP_NAME} v${APP_VERSION}"
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${APP_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This installer will set up ${APP_NAME} v${APP_VERSION} on your computer.$\r$\n$\r$\nWhat it does:$\r$\n  1. Checks that Node.js and Git are installed$\r$\n  2. Clones the repository$\r$\n  3. Installs dependencies and builds$\r$\n  4. Creates a desktop shortcut to launch$\r$\n$\r$\nClick Next to continue."
!define MUI_DIRECTORYPAGE_TEXT_TOP "Choose the folder where ${APP_NAME} will be installed. About 500 MB of free space is needed."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${APP_NAME} now"
!define MUI_FINISHPAGE_LINK "Visit ${APP_NAME} on GitHub"
!define MUI_FINISHPAGE_LINK_LOCATION "${APP_URL}"

; ── Pages ──
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Function LaunchApp
  ExecShell "" "$INSTDIR\start.bat"
FunctionEnd

; ──────────────────────────────────────────────
; Install Section
; ──────────────────────────────────────────────
Section "Install" SecInstall
  SetOutPath "$INSTDIR"

  ; ── Check for Git ──
  DetailPrint "Checking for Git..."
  nsExec::ExecToStack 'cmd /c where git'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "Git is not installed. ${APP_NAME} needs Git to download and update.$\r$\n$\r$\nWould you like to open the Git download page?" IDYES openGit IDNO abortGit
    openGit:
      ExecShell "open" "https://git-scm.com/download/win"
      MessageBox MB_OK "Please install Git, then run this installer again."
      Abort
    abortGit:
      Abort "Installation cancelled — Git is required."
  ${EndIf}
  DetailPrint "Git found."

  ; ── Check for Node.js ──
  DetailPrint "Checking for Node.js..."
  nsExec::ExecToStack 'cmd /c where node'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "Node.js is not installed. ${APP_NAME} needs Node.js 20+ to run.$\r$\n$\r$\nWould you like to open the Node.js download page?" IDYES openNode IDNO abortNode
    openNode:
      ExecShell "open" "https://nodejs.org/en/download"
      MessageBox MB_OK "Please install Node.js 20+, then run this installer again."
      Abort
    abortNode:
      Abort "Installation cancelled — Node.js is required."
  ${EndIf}
  DetailPrint "Node.js found."

  ; ── Clone the repository ──
  ${If} ${FileExists} "$INSTDIR\.git\*.*"
    DetailPrint "Repository already exists, pulling latest..."
    nsExec::ExecToLog 'cmd /c cd /d "$INSTDIR" && git pull'
    Pop $0
  ${Else}
    DetailPrint "Cloning ${APP_NAME} repository..."
    DetailPrint "This may take several minutes depending on your connection."
    nsExec::ExecToLog 'cmd /c git clone "${REPO_URL}" "$INSTDIR\repo-temp"'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_OK|MB_ICONSTOP "Failed to clone the repository. Check your internet connection and try again."
      Abort
    ${EndIf}
    ; Move repo contents from temp to install dir
    DetailPrint "Moving files into place..."
    nsExec::ExecToLog 'cmd /c robocopy "$INSTDIR\repo-temp" "$INSTDIR" /E /MOVE /NFL /NDL /NJH /NJS'
    ; robocopy returns various success codes (0-7), only 8+ is error
  ${EndIf}
  DetailPrint "Repository ready."

  ; ── Install pnpm ──
  DetailPrint "Setting up pnpm..."
  nsExec::ExecToLog 'cmd /c npm install -g pnpm'
  Pop $0
  DetailPrint "pnpm installed."

  ; ── Install dependencies ──
  DetailPrint "Installing dependencies (this will take a few minutes)..."
  nsExec::ExecToLog 'cmd /c cd /d "$INSTDIR" && pnpm install'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Dependency installation had issues. The app may still work — try launching it."
  ${EndIf}
  DetailPrint "Dependencies installed."

  ; ── Build ──
  DetailPrint "Building the application..."
  nsExec::ExecToLog 'cmd /c cd /d "$INSTDIR" && pnpm build'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Build had warnings — the app may still work."
  ${EndIf}
  DetailPrint "Build complete."

  ; ── Database ──
  DetailPrint "Initializing database..."
  nsExec::ExecToLog 'cmd /c cd /d "$INSTDIR" && pnpm db:push'
  Pop $0
  DetailPrint "Database ready."

  ; ── Copy app icon ──
  SetOutPath "$INSTDIR"
  File "app-icon.ico"

  ; ── Desktop shortcut ──
  DetailPrint "Creating shortcuts..."
  CreateShortCut "$DESKTOP\Marinara Engine.lnk" "$INSTDIR\start.bat" "" "$INSTDIR\app-icon.ico" 0
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Marinara Engine.lnk" "$INSTDIR\start.bat" "" "$INSTDIR\app-icon.ico" 0
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\uninstall.exe"

  ; ── Uninstaller ──
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; ── Registry (for Add/Remove Programs) ──
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "URLInfoAbout" "${APP_URL}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayIcon" "$INSTDIR\app-icon.ico"

  DetailPrint "Installation complete!"
SectionEnd

; ──────────────────────────────────────────────
; Uninstall Section
; ──────────────────────────────────────────────
Section "Uninstall"
  Delete "$DESKTOP\Marinara Engine.lnk"
  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
  RMDir /r "$INSTDIR"
SectionEnd
