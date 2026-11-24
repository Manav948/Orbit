# Orbit — Build Guide

## Development Environment Setup

### 1. Install Prerequisites

```powershell
# 1. Install Rust (stable toolchain)
winget install Rustlang.Rustup
rustup default stable
rustup target add x86_64-pc-windows-msvc

# 2. Install Node.js 20 LTS
winget install OpenJS.NodeJS.LTS

# 3. Install Visual Studio C++ Build Tools (required by Tauri)
winget install Microsoft.VisualStudio.2022.BuildTools
# Select: Desktop Development with C++

# 4. Install WebView2 Runtime (required at runtime)
# Usually pre-installed on Windows 11; if missing:
# https://developer.microsoft.com/microsoft-edge/webview2/
```

### 2. Clone and Install

```powershell
cd d:\Fullstack\Orbit

# Install Node dependencies
npm install

# Verify Rust dependencies compile
cargo check --manifest-path src-tauri\Cargo.toml
```

---

## Development Mode

```powershell
# Start the Tauri dev server with hot reload
npm run tauri dev
```

This starts:
- Vite dev server on `http://localhost:1420`
- Rust backend compiled in debug mode
- Tauri window with hot-reload enabled

---

## Production Build

```powershell
npm run tauri build
```

This runs:
1. `npm run build` → `tsc && vite build` → `dist/assets/index-*.js`
2. Rust compiled with `opt-level=3`, `lto=true`, `codegen-units=1`, `panic=abort`, `strip=true`
3. Tauri bundles the app into:

```
src-tauri\target\release\
  ├── desktop-intelligence-assistant.exe     ← standalone executable
  └── bundle\
      ├── nsis\
      │   └── Orbit_0.1.0_x64-setup.exe    ← NSIS installer
      └── msi\
          └── Orbit_0.1.0_x64_en-US.msi    ← MSI package
```

---

## Build Profiles

The `[profile.release]` in `Cargo.toml` is configured for maximum size reduction:

```toml
[profile.release]
codegen-units = 1   # Maximize cross-crate optimization
lto = true          # Link-time optimization (thin)
opt-level = 3       # Maximum optimization
panic = "abort"     # Smaller binary, faster abort on panic
strip = true        # Strip debug symbols from binary
```

---

## Frontend-Only Build

```powershell
npm run build
# Output: dist/assets/index-*.js (~497 kB JS, ~134 kB CSS)
```

---

## TypeScript Type Check

```powershell
npx tsc --noEmit
# Expected: 0 errors
```

---

## Rust Compilation Check (no linking)

```powershell
cargo check --manifest-path src-tauri\Cargo.toml
# Expected: Finished dev profile in ~5-15s, 0 errors
```

---

## Key Dependencies

### Rust (Cargo.toml)

| Crate | Purpose |
|---|---|
| `tauri 2` | Desktop application framework |
| `tauri-plugin-opener` | Open external URLs safely |
| `tauri-plugin-global-shortcut` | Alt+Space hotkey |
| `tauri-plugin-notification` | Windows toast notifications |
| `tauri-plugin-single-instance` | Prevents duplicate app instances |
| `rusqlite` (bundled + backup) | SQLite database with online backup API |
| `reqwest` (rustls-tls) | HTTP client for RSS and AI API requests |
| `feed-rs` | RSS and Atom feed parser |
| `serde / serde_json` | Serialization for IPC and storage |
| `tokio` | Async runtime for concurrent fetch operations |

### Node / npm

| Package | Purpose |
|---|---|
| `@tauri-apps/api` | Tauri IPC bridge |
| `@tauri-apps/plugin-opener` | URL opener plugin |
| `react 19` | UI framework |
| `tailwindcss v4` | Utility CSS |
| `vite 8` | Build tool |
| `lucide-react` | Icon library |
| `shadcn/ui` | UI component primitives |

---

## CI/CD Checklist

Before releasing:

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run build` → clean Vite build
- [ ] `cargo check` → 0 errors, 0 warnings
- [ ] `npm run tauri build` → installer generated
- [ ] Verify `nexora.db` creates correctly at `D:\extra file\database\`
- [ ] Test Alt+Space global shortcut
- [ ] Test AI provider connection (Groq/OpenAI/Gemini)
- [ ] Test RSS sync (at least 1 feed)
- [ ] Test database backup/restore cycle
- [ ] Code-sign installer (see SECURITY.md)

