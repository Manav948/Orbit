# Nexora — Desktop Intelligence

> A lightweight, local-first Windows desktop intelligence application built with **Tauri 2 · Rust · React · TypeScript · SQLite**.

Nexora lives as a **Dynamic Island** at the top-center of your screen. Press **Alt+Space** to open it, and it surfaces AI-powered news analysis, daily briefings, a conversational assistant, and live market data — all without sending your data anywhere it shouldn't go.

---

## ✨ Feature Overview

| Feature | Technology |
|---|---|
| Dynamic Island UI | Tauri 2 transparent window, React 19, Tailwind CSS v4 |
| RSS News Aggregation | 15+ verified publisher feeds (Reuters, BBC, TechCrunch, …) |
| AI Story Intelligence | Deduplication, clustering, importance scoring |
| AI Daily Briefings | Morning, Overnight, World, Technology, Finance summaries |
| Multi-Provider AI | Groq · OpenAI · Google Gemini (user-selectable) |
| Conversational Assistant | Multi-turn chat with news context injection |
| Finance Intelligence | Finnhub real-time quotes · 7-point sparklines · watchlist |
| Voice & Speech | Web Speech API dictation + TTS with system voices |
| Desktop Notifications | Windows toast alerts with quiet-hours schedule |
| Local SQLite Storage | WAL mode, 64 MB cache, online backup/restore |
| Secure Credential Storage | API keys stored via OS keychain, never in React/DB |
| Single-instance | Second launch focuses existing island |

---

## 🏗 Architecture

```
Nexora/
├── src/                        # React + TypeScript frontend
│   ├── components/
│   │   ├── DynamicIsland/      # CollapsedIsland, ExpandedIsland (5 modes)
│   │   └── Settings/           # Full settings panel (10 tabs)
│   ├── services/
│   │   ├── dbService.ts        # Typed Tauri IPC client
│   │   ├── voiceService.ts     # Web Speech API dictation
│   │   └── ttsService.ts       # Text-to-speech service
│   └── types/, utils/
├── src-tauri/                  # Rust/Tauri backend
│   ├── src/
│   │   ├── ai/                 # Multi-provider AI engine (Groq/OpenAI/Gemini)
│   │   ├── commands/           # Tauri IPC handlers (input-validated)
│   │   ├── db/                 # Connection, migrations, repository, backup
│   │   ├── finance/            # Finnhub client, watchlist
│   │   ├── news/               # RSS fetcher, categorizer, sync engine
│   │   └── notifications/      # Desktop notification dispatch
│   ├── Cargo.toml
│   └── tauri.conf.json
├── INSTALLATION.md
├── CONFIGURATION.md
├── SECURITY.md
├── BUILD.md
└── CHANGELOG.md
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Minimum |
|---|---|
| Windows 10/11 64-bit | Build 1903+ |
| Microsoft WebView2 Runtime | Evergreen (auto-installed by NSIS installer) |
| Node.js | 20 LTS |
| Rust toolchain | 1.77+ (stable) |

### Run in Development

```powershell
# Install dependencies
npm install

# Start Tauri development server (hot reload)
npm run tauri dev
```

### Build Production Installer

```powershell
npm run tauri build
# Installer: src-tauri/target/release/bundle/nsis/Nexora_0.1.0_x64-setup.exe
```

---

## ⌨ Global Shortcut

| Action | Shortcut |
|---|---|
| Toggle Dynamic Island | **Alt+Space** (configurable in Settings → Shortcuts) |
| Close / hide island | Click outside or press **Alt+Space** again |

---

## 🗄 Database

- **Location (priority):** `D:\extra file\database\nexora.db`
- **Fallback:** `%APPDATA%\com.nexora.app\nexora.db`
- **Engine:** SQLite 3 with WAL journal, 64 MB cache, memory temp store
- **Backup:** Settings → About & Storage → Backup Database

---

## 🔒 Security

- API keys stored in OS keychain — never in SQLite, logs, or the React bundle
- External URLs validated to `http://` / `https://` before navigation
- IPC commands validate all string inputs (length bounds, character checks)
- Database verified with `PRAGMA quick_check` on every launch; corrupted files are quarantined automatically
- Detailed security documentation: [SECURITY.md](SECURITY.md)

---

## 📚 Documentation

| Document | Contents |
|---|---|
| [INSTALLATION.md](INSTALLATION.md) | Windows installer guide, first-run setup, troubleshooting |
| [CONFIGURATION.md](CONFIGURATION.md) | AI providers, finance API, RSS feeds, shortcuts, voice |
| [SECURITY.md](SECURITY.md) | API key isolation, URL validation, IPC hardening, DB integrity |
| [BUILD.md](BUILD.md) | Dev environment setup, release build, CI/CD checklist |
| [CHANGELOG.md](CHANGELOG.md) | Full development history across all 10 stages |

---

## 📄 License

Personal / development use. See individual library licenses in `Cargo.toml` and `package.json`.
