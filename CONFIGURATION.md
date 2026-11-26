# Orbit — Configuration Guide

All configuration is done through **Settings → (tab)** inside the expanded Dynamic Island. API keys are stored securely via the platform credential store and are never written to the SQLite database, log files, or the React bundle.

---

## Multi-Provider AI

Orbit supports three AI providers. Each stores its key independently so you can switch without re-entering credentials.

| Provider | Recommended Model | Use Case |
|---|---|---|
| **Groq** | `openai/gpt-oss-20b` | Fast question answering and news analysis |
| **OpenAI** | `gpt-4o-mini` | Balanced quality and cost |
| **Google Gemini** | `gemini-1.5-flash` | Long-context briefings |

### Setup Steps

1. Open Settings → **Multi-Provider AI**.
2. Select your preferred provider from the dropdown.
3. Paste your API key in the field and click **Save**.
4. Click **Test Connection** to verify the key is accepted.
5. Select the model you want to use for that provider.
6. Repeat for each provider you want available.
7. Use the **Active Provider** toggle to switch which provider is used for all AI operations.

Groq requests use its OpenAI-compatible Responses API endpoint (`/responses`).

> **Security note:** API keys are passed directly to the Tauri backend over the IPC bridge and stored using the OS keychain. They are never exposed to the JavaScript runtime, the browser `window` object, or any log file.

---

## Ask Orbit

Ask Orbit combines relevant local dispatches and AI story summaries. Broad news overviews also include the latest dispatches and live watchlist quotes when available. With Groq selected, Orbit can add current web search results; local dispatches, web sources, and live market quote providers are shown separately below the answer. Sample market-preview values are not used as live context.

## Assistant Voice

Click the microphone in the collapsed Orbit pill or in the Assistant view and speak. After about two seconds of silence, Orbit sends the transcription and speaks the response. Answers from the collapsed pill appear in a compact version of the island; click the close icon to dismiss it or the island header to open the full view. Click the microphone again to stop recording manually.

---

## Finance Intelligence

1. Create a free account at [finnhub.io](https://finnhub.io) and generate an API key.
2. Open Settings → **Finance & Stocks**.
3. Paste the Finnhub API key and click **Save**.
4. Add ticker symbols to your watchlist (e.g. `AAPL`, `TSLA`, `NVDA`, `BTC.X`).
5. Quotes refresh on demand from the Markets mode in the Dynamic Island.

> **Free tier:** Finnhub's free tier allows ~60 API calls/minute. Orbit respects this by batching watchlist requests and not auto-polling continuously.

---

## RSS News Sources

Default sources are seeded on first launch:

| Category | Publisher |
|---|---|
| World | Reuters, BBC News, Associated Press |
| Technology | TechCrunch, The Verge, Ars Technica |
| AI | OpenAI Blog, Google AI Blog, Anthropic Blog |
| Business | CNBC |

**To add a custom feed:**
1. Open Settings → **News Feeds**.
2. Enter the feed name, the RSS/Atom URL, and select a category.
3. Click **Add Feed**.
4. Click **Sync All Feeds** to fetch articles immediately.

**To disable a feed:**  Toggle the switch on any source in the list.

---

## Notifications & Quiet Hours

Open Settings → **Notifications**:

| Setting | Default | Description |
|---|---|---|
| Master Notifications | On | Master enable/disable |
| Breaking News | On | High-importance world events |
| Daily Briefings | On | Alert when AI briefing completes |
| Finance Alerts | Off | Major watchlist price swings |
| Quiet Hours | Off | Suppress all alerts on a schedule |
| Quiet Hours Start | 22:00 | No alerts after this time |
| Quiet Hours End | 08:00 | Alerts resume from this time |

---

## Global Shortcut

Open Settings → **Shortcuts**:

1. Click **Record Shortcut**.
2. Press your desired key combination (e.g. `Ctrl+Shift+N`).
3. Click **Save**.

The old shortcut is unregistered and the new one is registered immediately.

**Default:** `Alt+Space`

---

## Voice & Speech

Open Settings → **Voice & Speech**:

- **Dictation** uses the Web Speech API (browser speech recognition) built into WebView2.
- **Text-to-Speech** uses Windows' built-in speech synthesis voices.
- Select a TTS voice from the dropdown and adjust the speech rate.
- Click **Test Voice** to preview the selected voice.

---

## Appearance

Open Settings → **Appearance**:

| Option | Choices |
|---|---|
| Theme | Dark / Light / System |
| Accent Color | Amber / Cyber / Emerald / Violet |
| Island Scale | 80% – 120% |
| Animations | On / Off |
| Glass Blur | Light / Medium / Strong |
| Default Island Mode | Collapsed / Expanded |

