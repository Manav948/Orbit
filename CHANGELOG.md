# Orbit — Changelog

All notable changes to this project are documented here.

---

## [0.1.0-rc] — 2026-11-21 (Release Candidate)

### Stage 10: Final Hardening & Release Preparation

#### Performance
- SQLite WAL journal mode + 64 MB cache + mmap + memory temp store applied on every connection
- `rusqlite` `backup` feature enabled for zero-lock online backup API
- Input validation on all IPC commands prevents unbounded allocations

#### Security
- `handleOpenArticle` now rejects any URL that does not start with `http://` or `https://`, blocking arbitrary protocol execution (cmd://, file://, javascript:)
- IPC message validation: `assistant_send_message` enforces max 10,000 chars; `ai_ask_question` enforces max 2,000 chars; `finance_get_quote` enforces 1–16 char uppercase symbol
- `db_restore_database` verifies backup file with `PRAGMA quick_check` before overwriting the live database
- API keys confirmed absent from SQLite, frontend bundle, and log output

#### Database & Storage Management (new Rust commands)
- `db_get_storage_breakdown` — returns live row counts for all tables plus file size in bytes and MB
- `db_clear_temporary_cache` — prunes articles older than 14 days + notification logs older than 7 days + runs VACUUM; permanently preserves briefings, conversations, and preferences
- `db_backup_database` — online SQLite backup to timestamped file using the official `rusqlite::backup::Backup` API
- `db_restore_database` — restores from a verified backup archive

#### System Telemetry (new Rust command)
- `system_get_process_metrics` — reads actual Windows working set size and peak RAM from `K32GetProcessMemoryInfo` via `extern "system"` FFI; also reads kernel+user CPU time and process uptime from `GetProcessTimes` / `GetSystemTimeAsFileTime`
- Non-Windows platforms receive a stub implementation

#### Settings — About & Storage tab (UI)
- Renamed "About Orbit" tab to "About & Storage"
- Live process telemetry card: RAM working set, peak RAM, total CPU time, session uptime
- SQLite storage breakdown card: file path, disk footprint (MB), per-table row counts
- Safe Cache Cleanup button with feedback showing freed KB and pruned row counts
- Backup Database button (saves `nexora_backup_<timestamp>.db` next to the main database)
- Restore Database input + button with backup path field

#### TypeScript
- Added `StorageBreakdown`, `CleanupResult`, and `ProcessMetrics` interfaces to `dbService.ts`
- Added `getStorageBreakdown()`, `clearTemporaryCache()`, `backupDatabase()`, `restoreDatabase()`, and `getProcessMetrics()` methods to `dbService`

---

## [0.1.0-beta.6] — Stage 9: Performance Optimization & Security Audit

- Branding unified as **Orbit** across `tauri.conf.json`, window title, tray menu, tooltip, and error strings
- Database corruption detection: `PRAGMA quick_check` on startup; corrupted files quarantined with timestamp suffix
- High-performance SQLite PRAGMAs applied: WAL, synchronous=NORMAL, cache_size=-64000, mmap_size=268435456, temp_store=MEMORY, busy_timeout=5000

---

## [0.1.0-beta.5] — Stage 8: Multi-Provider AI + Voice + Finance + Notifications

- Multi-provider AI client: Groq, OpenAI, Google Gemini with unified interface and masked key display
- Conversational assistant with multi-turn memory and SQLite conversation history (migration 6)
- Finance intelligence: Finnhub real-time quotes, 7-point sparklines, watchlist management
- Desktop notifications: Windows toast via `tauri-plugin-notification`, quiet-hours schedule, 15-minute duplicate suppression
- Voice dictation via Web Speech API; TTS via `window.speechSynthesis` with system voice enumeration
- Settings panels: Multi-Provider AI, Voice & Speech, Finance & Watchlist, Notifications & Quiet Hours

---

## [0.1.0-beta.4] — Stage 7: Dashboard & Daily Briefing UI

- Dynamic Island expanded to 5 modes: AI Stories, Assistant, Briefings, Markets, Dispatches
- Story cards with AI summary, what happened / why it matters / what's next / what's uncertain sections
- Daily Briefing panel: Morning, Overnight, World, Technology & AI, Finance briefings
- Category filters, publisher badges, importance indicators (Breaking, Important, Regular)
- TTS controls and dictation mic integrated into island header
- Markets mode: sparkline SVGs, price change badges, watchlist management

---

## [0.1.0-beta.3] — Stage 6: AI Intelligence Engine

- AI engine processes batched article metadata (not full content) to minimize API cost
- Cluster-based deduplication: articles covering the same event merged into one story
- Importance scoring and ranking: Breaking > Important > Regular
- `process_news_intelligence` command with force-refresh option
- `generate_briefing` with configurable type and length
- `ask_question` with optional story context injection

---

## [0.1.0-beta.2] — Stage 5: RSS News Aggregation Engine

- 15 verified RSS/Atom feed URLs seeded at first launch
- Async concurrent feed fetching with 10-second timeout and 10-request concurrency cap
- Feed-rs parser handles both RSS 2.0 and Atom 1.0 formats
- Content hash deduplication prevents re-inserting identical articles
- ETag / Last-Modified caching reduces server load
- Auto-categorization from feed metadata with keyword override
- SyncReport returned to frontend with per-feed success/error detail

---

## [0.1.0-beta.1] — Stage 4: SQLite Database

- Database auto-created at `D:\extra file\database\nexora.db` with APPDATA fallback
- Six schema migrations: Settings, NewsSources, Articles, Briefings, UserPreferences, Conversations, ConversationMessages, NotificationLogs
- Repository layer: typed Rust functions for every table operation
- Appropriate indexes on category, source_id, published_at, and conversation_id
- Full Tauri IPC command set exposed to frontend

---

## [0.1.0-alpha] — Stage 1–3: Foundation

- Tauri 2 project initialized with React + TypeScript + Vite + Tailwind CSS v4
- Dynamic Island UI: collapsed pill (360×48) ↔ expanded panel (680×520)
- System tray integration with right-click menu
- Global shortcut registration (Alt+Space)
- Single-instance enforcement
- JSON-persisted user preferences
- Window positioned top-center with configurable gap

