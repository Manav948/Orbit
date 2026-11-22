# Nexora — Security Architecture

## Threat Model

Nexora is a personal desktop application running on Windows. Its primary security concerns are:

1. **API key exposure** — Provider keys must not leak to the UI, logs, or on-disk plaintext.
2. **Arbitrary protocol execution** — Links opened from news articles must be strictly HTTP/HTTPS.
3. **IPC injection** — Frontend inputs must be validated before the Rust backend acts on them.
4. **Database integrity** — The SQLite file must be protected against corruption and accidental overwrites.

---

## API Key Isolation

| Layer | Protection |
|---|---|
| Rust backend | Keys are read from the OS keychain via `tauri-plugin-keychain`; never written to SQLite, logs, or stdout |
| IPC bridge | The frontend receives a **masked key** (`sk-...••••••`) only for display confirmation; the raw key is never serialized to JSON sent to React |
| React / TypeScript | No `window.*` storage, no `localStorage`, no `sessionStorage`, no `indexedDB` |
| Log files | The Rust backend explicitly avoids printing key material; `eprintln!` calls never format a full key |
| SQLite | The Settings table stores provider configuration metadata but **not** raw API keys |

---

## URL Navigation Security

External links opened from news stories go through `handleOpenArticle` which enforces:

```typescript
if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
  console.warn("Blocked non-HTTP link navigation for security:", url);
  return;
}
```

This prevents execution of `cmd://`, `file://`, `javascript:`, or other protocol handlers that could allow arbitrary code execution through a maliciously crafted RSS entry.

---

## IPC Input Validation

Rust commands validate untrusted inputs before acting:

| Command | Validation |
|---|---|
| `assistant_send_message` | Non-empty; max 10,000 chars |
| `ai_ask_question` | Non-empty; max 2,000 chars |
| `finance_get_quote` | 1–16 uppercase alphanumeric chars |
| `db_restore_database` | Non-empty path; backup verified with `PRAGMA quick_check` before restore |

---

## Database Security

| Feature | Implementation |
|---|---|
| Corruption detection | `PRAGMA quick_check` runs on every startup |
| Corrupted file quarantine | Renamed to `nexora.corrupted.<timestamp>.db` before recreating |
| WAL journal mode | Prevents torn writes on power loss |
| Online backup | Uses SQLite's official Backup API — no file-level copy while DB is live |
| Restore verification | Backup file integrity checked before it overwrites the live database |

---

## Tauri Capability Surface

The Tauri capabilities file (`src-tauri/capabilities/default.json`) restricts what the WebView can access:

- `opener:default` — allows opening external URLs via `openUrl()` (enforced to HTTP/HTTPS by frontend validation)
- `notification:default` — allows Windows toast notifications
- No filesystem read/write access from the frontend
- No shell execution from the frontend
- No WebSocket or raw TCP access

---

## Least-Privilege Principles

- The Rust backend exposes only named IPC commands; there is no generic `eval` or shell-exec command.
- The frontend never calls `invoke` with dynamic command names constructed from user input.
- SQLite foreign key enforcement is ON (`PRAGMA foreign_keys = ON`).
- Article content is not stored; only metadata (title, description, URL, source, timestamps) is kept.

---

## Code-Signing (Release)

The current build is **unsigned**. For production distribution:

1. Obtain an Extended Validation (EV) or standard code-signing certificate from a CA (DigiCert, Sectigo, etc.).
2. Configure `src-tauri/tauri.conf.json` → `bundle.windows.certificateThumbprint` with your certificate thumbprint.
3. Set the `TAURI_SIGNING_PRIVATE_KEY` environment variable for Tauri's updater signing if using auto-update.
4. Run `npm run tauri build` on a machine with the certificate installed in the Windows certificate store.

**Without code-signing:** Windows SmartScreen will display an "Unknown Publisher" warning on first run. Users can bypass this by clicking "More info → Run anyway".

