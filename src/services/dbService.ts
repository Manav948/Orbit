/**
 * dbService.ts
 *
 * Typed TypeScript client for all Nexora SQLite database and news aggregation IPC commands.
 * Every method is async and uses the Tauri `invoke` bridge so database
 * and network operations never block the React render thread.
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauriEnvironment, normalizeError } from "./tauriBridge";

// ─────────────────────────────────────────────────────────────────────────────
// Domain Types
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
  etag?: string | null;
  last_modified?: string | null;
  last_fetched_at?: string | null;
  last_error?: string | null;
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
  publisher?: string | null;
  guid?: string | null;
  content_hash?: string | null;
}

export interface NewArticle {
  title: string;
  description?: string | null;
  source_id: number;
  article_url: string;
  category: string;
  published_at?: string | null;
  publisher?: string | null;
  guid?: string | null;
  content_hash?: string | null;
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
  db_path?: string;
  settings: number;
  news_sources: number;
  articles: number;
  briefings: number;
  category_preferences: number;
}

export interface SyncReport {
  total_sources: number;
  fetched_sources: number;
  new_articles: number;
  errors: string[];
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper
// ─────────────────────────────────────────────────────────────────────────────

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnvironment()) {
    console.warn(`[Web Preview] Command '${command}' called in non-Tauri mode.`);
    throw normalizeError(
      `[Web Preview] Command '${command}' is only available in native desktop mode.`
    );
  }
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    throw normalizeError(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Database & News Service
// ─────────────────────────────────────────────────────────────────────────────

export const dbService = {
  // ── Settings ──────────────────────────────────────────────────────────────
  async getSetting(key: string): Promise<string | null> {
    return call<string | null>("db_get_setting", { key });
  },

  async upsertSetting(key: string, value: string): Promise<void> {
    return call<void>("db_upsert_setting", { key, value });
  },

  async deleteSetting(key: string): Promise<void> {
    return call<void>("db_delete_setting", { key });
  },

  async getAllSettings(): Promise<DbSetting[]> {
    return call<DbSetting[]>("db_get_all_settings");
  },

  // ── News Sources ──────────────────────────────────────────────────────────
  async getNewsSources(category?: string): Promise<NewsSource[]> {
    return call<NewsSource[]>("db_get_news_sources", { category: category ?? null });
  },

  async setNewsSourceEnabled(sourceId: number, enabled: boolean): Promise<void> {
    return call<void>("db_set_news_source_enabled", { source_id: sourceId, enabled });
  },

  async addNewsSource(name: string, url: string, category: string): Promise<number> {
    return call<number>("db_add_news_source", { name, url, category });
  },

  async deleteNewsSource(sourceId: number): Promise<void> {
    return call<void>("db_delete_news_source", { source_id: sourceId });
  },

  // ── RSS Feed Synchronization ──────────────────────────────────────────────
  async syncNewsFeeds(): Promise<SyncReport> {
    return call<SyncReport>("db_sync_news_feeds");
  },

  // ── Articles ──────────────────────────────────────────────────────────────
  async insertArticles(articles: NewArticle[]): Promise<number> {
    return call<number>("db_insert_articles", { articles });
  },

  async getArticles(category?: string, limit?: number): Promise<Article[]> {
    return call<Article[]>("db_get_articles", {
      category: category ?? null,
      limit: limit ?? null,
    });
  },

  async getArticlesPaginated(
    category?: string,
    search?: string,
    limit?: number,
    offset?: number
  ): Promise<Article[]> {
    return call<Article[]>("db_get_articles_paginated", {
      category: category ?? null,
      search: search ?? null,
      limit: limit ?? null,
      offset: offset ?? null,
    });
  },

  async pruneOldArticles(days?: number): Promise<number> {
    return call<number>("db_prune_old_articles", { days: days ?? null });
  },

  // ── Briefings ─────────────────────────────────────────────────────────────
  async upsertBriefing(briefing: NewBriefing): Promise<number> {
    return call<number>("db_upsert_briefing", { briefing });
  },

  async getLatestBriefings(): Promise<Briefing[]> {
    return call<Briefing[]>("db_get_latest_briefings");
  },

  async getBriefingsByCategory(category: string, limit?: number): Promise<Briefing[]> {
    return call<Briefing[]>("db_get_briefings_by_category", {
      category,
      limit: limit ?? null,
    });
  },

  // ── Category Preferences ──────────────────────────────────────────────────
  async getCategoryPreferences(): Promise<CategoryPreference[]> {
    return call<CategoryPreference[]>("db_get_category_preferences");
  },

  async upsertCategoryPreference(category: string, enabled: boolean): Promise<void> {
    return call<void>("db_upsert_category_preference", { category, enabled });
  },

  // ── Telemetry / Diagnostics ───────────────────────────────────────────────
  async getStats(): Promise<DbStats> {
    return call<DbStats>("db_get_stats");
  },
};
