/**
 * dbService.ts
 *
 * Typed TypeScript client for all Nexora SQLite database IPC commands.
 * Every method is async and uses the Tauri `invoke` bridge so database
 * operations never block the React render thread.
 *
 * In web/dev mode (non-Tauri) each method degrades gracefully to a no-op
 * or returns sensible empty-state defaults so the UI can still be iterated.
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauriEnvironment, normalizeError } from "./tauriBridge";

// ─────────────────────────────────────────────────────────────────────────────
// Domain Types (mirror the Rust structs in repository.rs)
// ─────────────────────────────────────────────────────────────────────────────

export interface DbSetting {
  id: number;
  key: string;
  value: string;
  updated_at: string;
}

export interface NewsSource {
  id: number;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  created_at: string;
}

export interface Article {
  id: number;
  title: string;
  description: string | null;
  source_id: number;
  article_url: string;
  category: string;
  published_at: string | null;
  fetched_at: string;
}

export interface NewArticle {
  title: string;
  description?: string | null;
  source_id: number;
  article_url: string;
  category: string;
  published_at?: string | null;
}

export interface Briefing {
  id: number;
  title: string;
  summary: string;
  category: string;
  created_at: string;
  last_updated_at: string;
}

export interface NewBriefing {
  title: string;
  summary: string;
  category: string;
}

export interface CategoryPreference {
  id: number;
  category: string;
  enabled: boolean;
  updated_at: string;
}

export interface DbStats {
  settings: number;
  news_sources: number;
  articles: number;
  briefings: number;
  category_preferences: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper
// ─────────────────────────────────────────────────────────────────────────────

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnvironment()) {
    throw normalizeError(
      `[Web Preview] Database command '${command}' is only available in native desktop mode.`
    );
  }
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    throw normalizeError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

export const dbService = {
  /**
   * Retrieve a single key-value setting from the database.
   * Returns `null` if the key does not exist.
   */
  async getSetting(key: string): Promise<string | null> {
    return call<string | null>("db_get_setting", { key });
  },

  /**
   * Insert or update a key-value setting.
   */
  async upsertSetting(key: string, value: string): Promise<void> {
    return call<void>("db_upsert_setting", { key, value });
  },

  /**
   * Delete a setting by key.
   */
  async deleteSetting(key: string): Promise<void> {
    return call<void>("db_delete_setting", { key });
  },

  /**
   * Return all settings rows.
   */
  async getAllSettings(): Promise<DbSetting[]> {
    return call<DbSetting[]>("db_get_all_settings");
  },

  // ─────────────────────────────────────────────────────────────────────────
  // News Sources
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retrieve all news sources, optionally filtered by category slug.
   */
  async getNewsSources(category?: string): Promise<NewsSource[]> {
    return call<NewsSource[]>("db_get_news_sources", { category: category ?? null });
  },

  /**
   * Enable or disable a news source by its numeric id.
   */
  async setNewsSourceEnabled(sourceId: number, enabled: boolean): Promise<void> {
    return call<void>("db_set_news_source_enabled", { source_id: sourceId, enabled });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Articles
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Batch-insert articles.  Duplicate URLs are silently ignored.
   * Returns the number of newly inserted rows.
   */
  async insertArticles(articles: NewArticle[]): Promise<number> {
    return call<number>("db_insert_articles", { articles });
  },

  /**
   * Retrieve recent articles, newest first.
   * @param category   optional category slug filter
   * @param limit      maximum rows to return (default 50, max 500)
   */
  async getArticles(category?: string, limit?: number): Promise<Article[]> {
    return call<Article[]>("db_get_articles", {
      category: category ?? null,
      limit: limit ?? null,
    });
  },

  /**
   * Delete articles older than `days` days (default 30).
   * Returns the count of deleted rows.
   */
  async pruneOldArticles(days?: number): Promise<number> {
    return call<number>("db_prune_old_articles", { days: days ?? null });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Briefings
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Upsert a briefing — updates the summary and timestamp if one already
   * exists for the same category, otherwise inserts a new row.
   * Returns the row id of the affected briefing.
   */
  async upsertBriefing(briefing: NewBriefing): Promise<number> {
    return call<number>("db_upsert_briefing", { briefing });
  },

  /**
   * Return the most recent briefing for each category.
   */
  async getLatestBriefings(): Promise<Briefing[]> {
    return call<Briefing[]>("db_get_latest_briefings");
  },

  /**
   * Return briefings for a specific category, newest first.
   */
  async getBriefingsByCategory(category: string, limit?: number): Promise<Briefing[]> {
    return call<Briefing[]>("db_get_briefings_by_category", {
      category,
      limit: limit ?? null,
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Category Preferences
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retrieve all per-category user preference rows.
   */
  async getCategoryPreferences(): Promise<CategoryPreference[]> {
    return call<CategoryPreference[]>("db_get_category_preferences");
  },

  /**
   * Enable or disable a category by its slug (e.g. "world-news").
   */
  async upsertCategoryPreference(category: string, enabled: boolean): Promise<void> {
    return call<void>("db_upsert_category_preference", { category, enabled });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Diagnostics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Return row counts for each table — useful for the About / diagnostics panel.
   */
  async getStats(): Promise<DbStats> {
    return call<DbStats>("db_get_stats");
  },
};

