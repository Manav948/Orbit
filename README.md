# Desktop Intelligence Assistant

A lightweight, production-oriented Windows desktop application initialized with **Tauri 2**, **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, and **Rust**.

---

## 🏛️ Architecture Overview

The application strictly separates presentation from native operating system logic:

```
┌────────────────────────────────────────────────────────┐
│                   React 19 (UI Layer)                  │
│       Components ──► Hooks ──► Typed Tauri Bridge      │
└───────────────────────────┬────────────────────────────┘
                            │
               Tauri 2 IPC (JSON RPC / Commands)
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Rust Native Core                    │
│   Commands (System, Diagnostics) ──► Native Win32 OS    │
└────────────────────────────────────────────────────────┘
```

1. **React & Tailwind CSS (Frontend UI)**:
   - Handles views, responsive desktop UI, user interaction, and error boundaries.
   - Built with Tailwind CSS v4 using Vite for lightning-fast HMR and minimal bundle footprint.
   - Zero heavyweight backend frameworks, no Electron, and no bloat.

2. **IPC Bridge & Service Layer (`src/services/tauriBridge.ts`)**:
   - Decouples UI components from raw Tauri APIs.
   - Provides strongly typed IPC invocations with runtime error normalization (`AppError`).
   - Supports standalone browser preview mode with graceful fallbacks for rapid UI development.

3. **Rust Core (`src-tauri`)**:
   - Manages native desktop capabilities, OS integration, and system telemetry.
   - Uses modular command handlers (`src-tauri/src/commands/`) with structured error handling (`Result<T, String>`).

---

## 📂 Project Structure

```
Orbit/
├── .vscode/                   # Recommended editor settings
├── public/                    # Static frontend assets
├── src/                       # Frontend application source
│   ├── assets/                # App-specific SVGs and graphical assets
│   ├── components/            # Reusable, presentation-only UI components
│   │   ├── common/
│   │   │   ├── Card.tsx           # Standard container card with backdrop blur
│   │   │   ├── ErrorBoundary.tsx  # React render error boundary catching UI exceptions
│   │   │   └── StatusBadge.tsx    # Visual status pills for host and network states
│   │   ├── AssistantStatus.tsx    # Native host diagnostics display
│   │   ├── Header.tsx             # Application top bar with system status badges
│   │   └── NativeActionPanel.tsx  # IPC dispatch form with error & response displays
│   ├── hooks/                 # Application logic & state management hooks
│   │   ├── useDesktopStatus.ts    # Polling & lifecycle management for system telemetry
│   │   └── useNativeAction.ts    # IPC action execution, loading, and error states
│   ├── services/              # Isolated bridge to native desktop backend
│   │   └── tauriBridge.ts         # Strongly-typed IPC wrapper with environment detection
│   ├── types/                 # TypeScript data contracts and error models
│   │   └── desktop.ts             # SystemInfo, AppStatus, AppError definitions
│   ├── App.tsx                # Main view layout
│   ├── index.css              # Tailwind CSS v4 entry and global styles
│   ├── main.tsx               # React root entry point with ErrorBoundary
│   └── vite-env.d.ts          # Vite client types
├── src-tauri/                 # Native Rust desktop application
│   ├── capabilities/
│   │   └── default.json       # Tauri 2 security permissions & window capabilities
│   ├── icons/                 # Application icons for Windows desktop (.ico, .png)
│   ├── src/
│   ├── commands/              # Native Rust command modules
│   │   │   ├── mod.rs
│   │   │   └── system.rs      # System telemetry, app status, and validated ping commands
│   │   ├── lib.rs             # Tauri application builder & command registration
│   │   └── main.rs            # Windows entry point (#![windows_subsystem = "windows"])
│   ├── build.rs               # Tauri build script
│   ├── Cargo.toml             # Rust package manifest & release size optimizations
│   └── tauri.conf.json        # Tauri 2 Windows window & build configuration
├── index.html                 # HTML application template
├── package.json               # Node.js dependencies & scripts
├── tsconfig.json              # TypeScript configuration
├── tsconfig.node.json         # TypeScript configuration for Vite
└── vite.config.ts             # Vite configuration with Tailwind CSS v4 & Tauri dev settings
```

---

## 🛠️ Prerequisites

Ensure the following tools are installed on your Windows development environment:

1. **Node.js**: v18+ (tested on Node.js v24.x) & npm.
2. **Rust & Cargo**: v1.75+ (tested on Rust 1.100.0).
   - Toolchains supported: `stable-x86_64-pc-windows-gnu` (MinGW) or `stable-x86_64-pc-windows-msvc`.
3. **Microsoft Edge WebView2**: Preinstalled on Windows 10 & 11.

---

## 🚀 Development Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Desktop Mode (Tauri 2 + Vite)
Launches the native Windows desktop application with live HMR:
```bash
npm run tauri dev
```

### 3. Run Frontend Standalone in Browser
For rapid UI prototyping without compiling the Rust backend:
```bash
npm run dev
```
Open your browser at `http://localhost:1420`. The IPC bridge will automatically detect the web preview environment and provide resilient mock responses.

### 4. Build Frontend Only
Validates TypeScript types and bundles the frontend with Vite:
```bash
npm run build
```

### 5. Build Desktop Production Executable
Compiles an optimized, lightweight Windows native binary (`.exe` / installer):
```bash
npm run tauri build
```
The output executable will be placed in `src-tauri/target/release/`.

---

## 🛡️ Error Handling Architecture

- **React Error Boundary**: `ErrorBoundary.tsx` prevents the entire desktop window from crashing when an unhandled component rendering error occurs, allowing the user to view the diagnostic error and reload the view.
- **IPC Error Normalization**: Rust commands return `Result<T, String>`. The frontend service layer (`tauriBridge.ts`) intercepts rejected promises and standardizes them into structured `AppError` objects `{ message, code, timestamp }`.
- **Validation Before Execution**: Command arguments (e.g. `ping`) are validated both client-side and server-side in Rust. Empty payloads gracefully return structured error feedback.
