# Orbit — Installation Guide

## System Requirements

| Component | Requirement |
|---|---|
| OS | Windows 10 (Build 1903+) or Windows 11 (64-bit) |
| Runtime | Microsoft WebView2 Evergreen Runtime |
| RAM | 60–120 MB working set at runtime |
| Disk | ~15 MB application, variable SQLite database |

---

## Installing from the NSIS Installer (Recommended)

1. Download `Orbit_0.1.0_x64-setup.exe` from the release folder:
   ```
   src-tauri\target\release\bundle\nsis\Orbit_0.1.0_x64-setup.exe
   ```
2. Double-click the installer and follow the wizard.
3. The installer will automatically install the **Microsoft WebView2 Runtime** if it is not already present on your system.
4. After installation, launch **Orbit** from the Start Menu or the desktop shortcut.
5. The Dynamic Island appears top-center. Press **Alt+Space** to toggle it.

---

## Installing from the MSI Package

```powershell
# Silent install
msiexec /i Orbit_0.1.0_x64_en-US.msi /quiet /norestart
```

---

## First-Run Setup

On first launch Orbit:

1. Creates (or opens) the SQLite database at `D:\extra file\database\nexora.db` (or the APPDATA fallback if that path is unavailable).
2. Runs all schema migrations automatically.
3. Seeds the 15 default RSS news sources.
4. Positions the Dynamic Island at the top-center of your primary display.
5. Registers **Alt+Space** as the global shortcut.
6. Adds a system-tray icon (right-click for menu).

No manual database setup is required.

---

## Uninstalling

**Via installer:** Use **Add or Remove Programs → Orbit → Uninstall**.

The SQLite database at `D:\extra file\database\nexora.db` is **not** deleted on uninstall (it contains your briefings, conversations, and preferences). Delete it manually if desired.

---

## Microsoft WebView2 Runtime

WebView2 ships pre-installed on Windows 11 and most up-to-date Windows 10 systems. If the app fails to open the UI:

1. Download the WebView2 Runtime from: https://developer.microsoft.com/microsoft-edge/webview2/
2. Install the **Evergreen Standalone Installer** for x64.
3. Relaunch Orbit.

---

## Troubleshooting

| Symptom | Resolution |
|---|---|
| Island does not appear | Check system tray → right-click Orbit → Open Orbit |
| `Alt+Space` does not work | Another app may hold the shortcut. Change it in Settings → Shortcuts |
| Database error on launch | Check that `D:\extra file\database\` is writable, or let it fall back to APPDATA |
| Blank white window | WebView2 Runtime is missing; install it (see above) |

