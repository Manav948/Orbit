//! Schema migrations.
//!
//! Each migration is a plain SQL string applied in-order using a simple
//! user_version-based migration tracker.  This keeps the codebase free of
//! extra migration-framework dependencies while remaining easy to extend.

use rusqlite::Connection;

/// All schema migrations in chronological order.
/// Each entry is `(version: u32, description: &str, sql: &str)`.
/// Add new migrations by appending to this slice — never modify existing ones.
static MIGRATIONS: &[(u32, &str, &str)] = &[
    (
        1,
        "initial schema",
        "
        -- ── key-value settings store ─────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS settings (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            key        TEXT    NOT NULL UNIQUE,
            value      TEXT    NOT NULL,
            updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_settings_key ON settings (key);

        -- ── news sources ──────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS news_sources (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            url        TEXT    NOT NULL UNIQUE,
            category   TEXT    NOT NULL,
            enabled    INTEGER NOT NULL DEFAULT 1,
            created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_news_sources_category ON news_sources (category);
        CREATE INDEX IF NOT EXISTS idx_news_sources_enabled  ON news_sources (enabled);

        -- ── articles ─────────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS articles (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT    NOT NULL,
            description TEXT,
            source_id   INTEGER NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
            article_url TEXT    NOT NULL UNIQUE,
            category    TEXT    NOT NULL,
            published_at TEXT,
            fetched_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_articles_category     ON articles (category);
        CREATE INDEX IF NOT EXISTS idx_articles_source_id    ON articles (source_id);
        CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles (published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_articles_fetched_at   ON articles (fetched_at  DESC);

        -- ── daily briefings ───────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS briefings (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            title           TEXT    NOT NULL,
            summary         TEXT    NOT NULL,
            category        TEXT    NOT NULL,
            created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
            last_updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_briefings_category   ON briefings (category);
        CREATE INDEX IF NOT EXISTS idx_briefings_created_at ON briefings (created_at DESC);

        -- ── per-category user preferences ─────────────────────────────────────
        CREATE TABLE IF NOT EXISTS user_category_preferences (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            category   TEXT    NOT NULL UNIQUE,
            enabled    INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_ucp_category ON user_category_preferences (category);
        ",
    ),
    (
        2,
        "seed default news sources",
        "
        INSERT OR IGNORE INTO news_sources (name, url, category, enabled) VALUES
            ('Reuters World',    'https://feeds.reuters.com/reuters/worldNews',  'world-news',       1),
            ('BBC News',         'https://feeds.bbci.co.uk/news/rss.xml',        'world-news',       1),
            ('Financial Times',  'https://www.ft.com/rss/home',                  'finance-markets',  1),
            ('Bloomberg',        'https://feeds.bloomberg.com/markets/news.rss', 'finance-markets',  1),
            ('Ars Technica',     'https://feeds.arstechnica.com/arstechnica/index', 'technology-ai', 1),
            ('MIT Tech Review',  'https://www.technologyreview.com/feed/',        'technology-ai',   1),
            ('Hacker News',      'https://hnrss.org/frontpage',                  'technology-ai',   1),
            ('The Economist',    'https://www.economist.com/rss/the_world_this_week_rss.xml', 'daily-knowledge', 1),
            ('Quanta Magazine',  'https://www.quantamagazine.org/feed/',          'science',         1),
            ('Harvard Business', 'https://feeds.hbr.org/harvardbusiness',         'business',        1);
        ",
    ),
    (
        3,
        "seed default category preferences",
        "
        INSERT OR IGNORE INTO user_category_preferences (category, enabled) VALUES
            ('world-news',       1),
            ('finance-markets',  1),
            ('technology-ai',    1),
            ('daily-knowledge',  1),
            ('business',         1),
            ('science',          1);
        ",
    ),
];

/// Applies any pending migrations to the database.
///
/// Uses SQLite's built-in `PRAGMA user_version` as the migration counter.
/// Each migration is wrapped in a transaction so a failure leaves the DB clean.
pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    // Read current schema version
    let current_version: u32 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|e| format!("Failed to read user_version PRAGMA: {e}"))?;

    for &(version, description, sql) in MIGRATIONS {
        if version <= current_version {
            continue; // already applied
        }

        eprintln!("[Nexora DB] Applying migration v{version}: {description}");

        // Execute the migration SQL in an implicit transaction provided by execute_batch
        conn.execute_batch(sql)
            .map_err(|e| format!("Migration v{version} ('{description}') failed: {e}"))?;

        // Advance the version counter — PRAGMA cannot be parameterised, so we format it directly
        conn.pragma_update(None, "user_version", version)
            .map_err(|e| format!("Failed to update user_version after migration v{version}: {e}"))?;

        eprintln!("[Nexora DB] Migration v{version} applied successfully.");
    }

    eprintln!("[Nexora DB] Schema is up-to-date at version {}", {
        MIGRATIONS.last().map(|(v, _, _)| *v).unwrap_or(current_version)
    });

    Ok(())
}

