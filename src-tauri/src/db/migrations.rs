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
    (
        4,
        "enhance news sources and articles schema for aggregation engine",
        "
        -- Add etag and last_modified to news_sources for conditional HTTP requests
        ALTER TABLE news_sources ADD COLUMN etag TEXT;
        ALTER TABLE news_sources ADD COLUMN last_modified TEXT;
        ALTER TABLE news_sources ADD COLUMN last_fetched_at TEXT;
        ALTER TABLE news_sources ADD COLUMN last_error TEXT;

        -- Add publisher, guid, and content_hash to articles for deduplication
        ALTER TABLE articles ADD COLUMN publisher TEXT;
        ALTER TABLE articles ADD COLUMN guid TEXT;
        ALTER TABLE articles ADD COLUMN content_hash TEXT;

        CREATE INDEX IF NOT EXISTS idx_articles_guid ON articles (guid);
        CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles (content_hash);
        CREATE INDEX IF NOT EXISTS idx_articles_publisher ON articles (publisher);

        -- Seed verified publisher feeds
        INSERT OR IGNORE INTO news_sources (name, url, category, enabled) VALUES
            ('BBC News World', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'world', 1),
            ('Associated Press', 'https://flipboard.com/@associatedpress/top-stories-u7govdf1z.rss', 'world', 1),
            ('Reuters World', 'https://news.google.com/rss/search?q=site:reuters.com/world&hl=en-US&gl=US&ceid=US:en', 'world', 1),
            ('TechCrunch', 'https://techcrunch.com/feed/', 'technology', 1),
            ('The Verge', 'https://www.theverge.com/rss/index.xml', 'technology', 1),
            ('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'technology', 1),
            ('OpenAI Blog', 'https://openai.com/news/rss.xml', 'ai', 1),
            ('Google AI Blog', 'https://blog.google/technology/ai/rss/', 'ai', 1),
            ('CNBC Business', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147', 'business', 1),
            ('CNBC Finance & Markets', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', 'finance', 1),
            ('MarketWatch Top Stories', 'https://feeds.content.dowjones.io/public/rss/mw_topstories', 'finance', 1),
            ('The Hacker News', 'https://feeds.feedburner.com/TheHackersNews', 'cybersecurity', 1),
            ('BleepingComputer', 'https://www.bleepingcomputer.com/feed/', 'cybersecurity', 1),
            ('Quanta Magazine', 'https://www.quantamagazine.org/feed/', 'science', 1);
        ",
    ),
    (
        5,
        "ai intelligence engine: story clusters, summaries, and briefing metadata",
        "
        -- Story clusters representing grouped news events analyzed by AI
        CREATE TABLE IF NOT EXISTS story_clusters (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            cluster_hash      TEXT    NOT NULL UNIQUE,
            category          TEXT    NOT NULL,
            title             TEXT    NOT NULL,
            what_happened     TEXT    NOT NULL,
            why_it_happened   TEXT    NOT NULL,
            why_it_matters    TEXT    NOT NULL,
            what_happens_next TEXT    NOT NULL,
            what_is_uncertain TEXT    NOT NULL,
            simple_summary    TEXT,
            detailed_summary  TEXT,
            decision_summary  TEXT,
            importance_score  INTEGER NOT NULL DEFAULT 50,
            model_used        TEXT    NOT NULL DEFAULT 'gpt-4o-mini',
            created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
            updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );

        CREATE INDEX IF NOT EXISTS idx_story_clusters_category   ON story_clusters (category);
        CREATE INDEX IF NOT EXISTS idx_story_clusters_score      ON story_clusters (importance_score DESC);
        CREATE INDEX IF NOT EXISTS idx_story_clusters_created_at ON story_clusters (created_at DESC);

        -- Junction table connecting story clusters with their supporting articles
        CREATE TABLE IF NOT EXISTS cluster_articles (
            cluster_id INTEGER NOT NULL REFERENCES story_clusters(id) ON DELETE CASCADE,
            article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            PRIMARY KEY (cluster_id, article_id)
        );

        CREATE INDEX IF NOT EXISTS idx_ca_cluster_id ON cluster_articles (cluster_id);
        CREATE INDEX IF NOT EXISTS idx_ca_article_id ON cluster_articles (article_id);

        -- Extend briefings table for rich multi-topic, multi-duration briefings
        ALTER TABLE briefings ADD COLUMN briefing_type TEXT DEFAULT 'general';
        ALTER TABLE briefings ADD COLUMN briefing_length TEXT DEFAULT 'standard';
        ALTER TABLE briefings ADD COLUMN model_used TEXT DEFAULT 'gpt-4o-mini';
        ALTER TABLE briefings ADD COLUMN articles_count INTEGER DEFAULT 0;

        -- Default AI configuration settings
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('openai_model', 'gpt-4o-mini'),
            ('ai_explanation_mode', 'simple'),
            ('briefing_length', 'standard');
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

