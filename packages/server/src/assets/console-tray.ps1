# Marinara Engine console tray helper (Windows only).
#
# Started hidden by the server (packages/server/src/services/console-tray/console-tray.service.ts)
# when the "consoleTray" feature switch is on. It shows a tray icon and hides the server's console
# window while that window is minimized. No native modules: plain Windows PowerShell 5.1,
# System.Windows.Forms and a few user32/kernel32 calls.
#
# Protocol (one line per message):
#   stdout: "ready hide"                 tray icon shown, minimizing the console hides it
#           "ready tray-only <reason>"   tray icon shown, the console is never hidden
#           "noconsole <reason>"         no visible console window, nothing shown, exiting
#           "open <url>"                 the user chose Open Marinara
#           "quit"                       the user chose Quit Marinara (the server shuts down gracefully)
#           "error <text>"               a non-fatal problem worth a warning
#   stdin:  "stop" or end of input       restore the console if it is hidden, remove the icon, exit
# The helper also exits (restoring the console) as soon as the parent process is gone. Node puts its
# children in a kill-on-exit job, so if the server dies abruptly the helper dies with it; for that
# case a small watchdog (started outside the job) shows the console again once the helper is gone.
param(
  [Parameter(Mandatory = $true)][int]$ParentPid,
  [Parameter(Mandatory = $true)][string]$Url,
  [int]$Port = 0,
  [string]$IconPath = ""
)

$ErrorActionPreference = "Stop"
# Bind stdout and stdin to the pipes the server gave us before touching any console.
$script:Out = [Console]::Out
$script:In = New-Object System.IO.StreamReader([Console]::OpenStandardInput())

function Send-Line([string]$Line) {
  try {
    $script:Out.WriteLine($Line)
    $script:Out.Flush()
  } catch {
    # The server is gone; the parent check below ends the helper.
  }
}

try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class MarinaraConsoleTrayNative {
    [DllImport("kernel32.dll", SetLastError = true)] public static extern bool AttachConsole(uint processId);
    [DllImport("kernel32.dll")] public static extern bool FreeConsole();
    [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hWnd, StringBuilder name, int max);

    public static string ClassOf(IntPtr hWnd) {
        var name = new StringBuilder(256);
        return GetClassName(hWnd, name, name.Capacity) > 0 ? name.ToString() : "";
    }

    /** The console window of another process, found by attaching to its console for a moment. */
    public static IntPtr ConsoleWindowOf(uint processId) {
        FreeConsole();
        if (!AttachConsole(processId)) return IntPtr.Zero;
        IntPtr hWnd = GetConsoleWindow();
        FreeConsole();
        return hWnd;
    }
}
"@
} catch {
  Send-Line ("error setup-failed " + $_.Exception.Message)
  exit 2
}

$SW_HIDE = 0
$SW_SHOWNORMAL = 1
$SW_SHOWNOACTIVATE = 4
$SW_SHOW = 5
$SW_SHOWMINNOACTIVE = 7
$SW_RESTORE = 9
$GA_ROOTOWNER = 3

try {
  $script:Parent = [System.Diagnostics.Process]::GetProcessById($ParentPid)
  # Keep a handle open so a reused process id can never be mistaken for the server.
  $null = $script:Parent.Handle
} catch {
  Send-Line "noconsole parent-gone"
  exit 0
}

if ($Url -notmatch '^https?://[^\s"]+$') {
  Send-Line "error bad-url"
  exit 2
}

# Find the server's console window.
$script:ConsoleHwnd = [MarinaraConsoleTrayNative]::ConsoleWindowOf([uint32]$ParentPid)
if ($script:ConsoleHwnd -eq [IntPtr]::Zero) {
  Send-Line "noconsole no-console"
  exit 0
}
$consoleClass = [MarinaraConsoleTrayNative]::ClassOf($script:ConsoleHwnd)
$script:CanHide = $true
$trayOnlyReason = ""
if ($consoleClass -eq "PseudoConsoleWindow") {
  # Windows Terminal (or another pseudo console host such as an editor terminal) draws the text in
  # its own window, which may hold other tabs. The pseudo window cannot be hidden usefully, and
  # hiding the whole host window could hide unrelated tabs, so only the tray icon is offered.
  $script:CanHide = $false
  $owner = [MarinaraConsoleTrayNative]::GetAncestor($script:ConsoleHwnd, $GA_ROOTOWNER)
  $ownerClass = if ($owner -ne [IntPtr]::Zero) { [MarinaraConsoleTrayNative]::ClassOf($owner) } else { "" }
  $trayOnlyReason = if ($ownerClass -eq "CASCADIA_HOSTING_WINDOW_CLASS") { "windows-terminal" } else { "pseudo-console" }
} elseif (-not [MarinaraConsoleTrayNative]::IsWindowVisible($script:ConsoleHwnd)) {
  # A console that is already hidden (started hidden, or as a service): nothing to manage.
  Send-Line "noconsole console-hidden"
  exit 0
}

# Started only when the helper may hide the console. Children of a job member break away from it
# silently, so the watchdog survives the server and this helper, waits for this helper to end, and
# shows the console again if it is still hidden (a clean stop has already done that).
function Start-Watchdog {
  $watch = @'
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -Namespace MarinaraConsoleTrayWatch -Name Native -MemberDefinition '[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);'
Wait-Process -Id __HELPER__
$h = [IntPtr]__HWND__
if ([MarinaraConsoleTrayWatch.Native]::IsWindow($h) -and -not [MarinaraConsoleTrayWatch.Native]::IsWindowVisible($h)) {
  [void][MarinaraConsoleTrayWatch.Native]::ShowWindow($h, $(if ([MarinaraConsoleTrayWatch.Native]::IsIconic($h)) { 7 } else { 4 }))
}
'@
  $watch = $watch.Replace("__HELPER__", [string]$PID).Replace("__HWND__", [string]$script:ConsoleHwnd.ToInt64())
  $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($watch))
  $exe = Join-Path $PSHOME "powershell.exe"
  Start-Process -FilePath $exe -WindowStyle Hidden -ArgumentList @("-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", $encoded) | Out-Null
}

function Test-ConsoleShown {
  return [MarinaraConsoleTrayNative]::IsWindowVisible($script:ConsoleHwnd)
}

function Show-Console([bool]$Activate) {
  if (-not $script:CanHide -or -not [MarinaraConsoleTrayNative]::IsWindow($script:ConsoleHwnd)) { return }
  if (Test-ConsoleShown) {
    if ($Activate) { [void][MarinaraConsoleTrayNative]::SetForegroundWindow($script:ConsoleHwnd) }
    return
  }
  $iconic = [MarinaraConsoleTrayNative]::IsIconic($script:ConsoleHwnd)
  if ($Activate) {
    [void][MarinaraConsoleTrayNative]::ShowWindow($script:ConsoleHwnd, $(if ($iconic) { $SW_RESTORE } else { $SW_SHOW }))
    [void][MarinaraConsoleTrayNative]::SetForegroundWindow($script:ConsoleHwnd)
  } else {
    # Put it back the way it was hidden, without stealing focus: minimized on the taskbar, or open.
    [void][MarinaraConsoleTrayNative]::ShowWindow($script:ConsoleHwnd, $(if ($iconic) { $SW_SHOWMINNOACTIVE } else { $SW_SHOWNOACTIVATE }))
  }
}

function Hide-Console {
  if (-not $script:CanHide -or -not [MarinaraConsoleTrayNative]::IsWindow($script:ConsoleHwnd)) { return }
  [void][MarinaraConsoleTrayNative]::ShowWindow($script:ConsoleHwnd, $SW_HIDE)
}

function Switch-Console {
  if (Test-ConsoleShown) { Hide-Console } else { Show-Console $true }
}

function Open-Marinara {
  try {
    Start-Process -FilePath $Url
    Send-Line ("open " + $Url)
  } catch {
    Send-Line ("error open-failed " + $_.Exception.Message)
  }
}

$script:Stopped = $false
function Stop-Helper {
  if ($script:Stopped) { return }
  $script:Stopped = $true
  try { $script:Timer.Stop() } catch {}
  # Never leave the console hidden behind us.
  try { Show-Console $false } catch {}
  try {
    $script:Icon.Visible = $false
    $script:Icon.Dispose()
  } catch {}
  try { $script:Context.ExitThread() } catch {}
}

# Tray icon and menu.
$script:Icon = New-Object System.Windows.Forms.NotifyIcon
try {
  if ($IconPath -and (Test-Path -LiteralPath $IconPath)) {
    $script:Icon.Icon = New-Object System.Drawing.Icon($IconPath, [System.Windows.Forms.SystemInformation]::SmallIconSize)
  } else {
    $script:Icon.Icon = [System.Drawing.SystemIcons]::Application
  }
} catch {
  $script:Icon.Icon = [System.Drawing.SystemIcons]::Application
}
$tip = if ($Port -gt 0) { "Marinara Engine (port $Port)" } else { "Marinara Engine" }
$script:Icon.Text = $tip.Substring(0, [Math]::Min(63, $tip.Length))

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = $menu.Items.Add("Open Marinara")
$openItem.Font = New-Object System.Drawing.Font($openItem.Font, [System.Drawing.FontStyle]::Bold)
$script:ToggleItem = $menu.Items.Add("Hide console")
$script:ToggleItem.Visible = $script:CanHide
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$script:QuitItem = $menu.Items.Add("Quit Marinara")

$menu.add_Opening({
  $script:ToggleItem.Text = if (Test-ConsoleShown) { "Hide console" } else { "Show console" }
})
$openItem.add_Click({ Open-Marinara })
$script:ToggleItem.add_Click({ try { Switch-Console } catch { Send-Line ("error toggle-failed " + $_.Exception.Message) } })
$script:QuitItem.add_Click({
  $script:QuitItem.Enabled = $false
  # Show the console first so the shutdown lines are visible, then ask the server to stop like Ctrl+C.
  try { Show-Console $true } catch {}
  Send-Line "quit"
})
$script:Icon.ContextMenuStrip = $menu
$script:Icon.add_MouseDoubleClick({
  param($sender, $e)
  if ($e.Button -ne [System.Windows.Forms.MouseButtons]::Left) { return }
  if ($script:CanHide) { try { Switch-Console } catch {} } else { Open-Marinara }
})
$script:Icon.Visible = $true

# One timer drives everything: parent watch, server commands, hide on minimize.
$script:ReadTask = $script:In.ReadLineAsync()
$script:Timer = New-Object System.Windows.Forms.Timer
# 250 ms keeps a "stop" from the server quick (it restores the console before the server exits);
# the minimize check runs on every other tick, about every 500 ms.
$script:Timer.Interval = 250
$script:TickCount = 0
$script:Timer.add_Tick({
  try {
    $script:TickCount++
    if ($script:Parent.HasExited) { Stop-Helper; return }
    while ($script:ReadTask.IsCompleted) {
      $line = if ($script:ReadTask.IsFaulted) { $null } else { $script:ReadTask.Result }
      if ($null -eq $line -or $line.Trim() -eq "stop") { Stop-Helper; return }
      $script:ReadTask = $script:In.ReadLineAsync()
    }
    if ($script:CanHide -and ($script:TickCount % 2 -eq 0)) {
      if (-not [MarinaraConsoleTrayNative]::IsWindow($script:ConsoleHwnd)) { Stop-Helper; return }
      if ([MarinaraConsoleTrayNative]::IsIconic($script:ConsoleHwnd) -and (Test-ConsoleShown)) { Hide-Console }
    }
  } catch {
    Send-Line ("error tick-failed " + $_.Exception.Message)
  }
})

$script:Context = New-Object System.Windows.Forms.ApplicationContext
$script:Timer.Start()
if ($script:CanHide) {
  try { Start-Watchdog } catch { Send-Line ("error watchdog-failed " + $_.Exception.Message) }
}
if ($script:CanHide) { Send-Line "ready hide" } else { Send-Line ("ready tray-only " + $trayOnlyReason) }
try {
  [System.Windows.Forms.Application]::Run($script:Context)
} finally {
  Stop-Helper
}
exit 0
