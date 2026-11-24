/**
 * dbService.ts
 *
 * Typed TypeScript client for all Orbit SQLite database, news aggregation,
 * multi-provider AI, conversational assistant, finance intelligence, and desktop notifications.
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
  briefing_type?: string | null;
  briefing_length?: string | null;
  model_used?: string | null;
  articles_count?: number | null;
}

export interface NewBriefing {
  title: string;
  summary: string;
  category: string;
  briefing_type?: string | null;
  briefing_length?: string | null;
  model_used?: string | null;
  articles_count?: number | null;
}

export interface StoryCluster {
  id: number;
  cluster_hash: string;
  category: string;
  title: string;
  what_happened: string;
  why_it_happened: string;
  why_it_matters: string;
  what_happens_next: string;
  what_is_uncertain: string;
  simple_summary?: string | null;
  detailed_summary?: string | null;
  decision_summary?: string | null;
  importance_score: number;
  model_used: string;
  created_at: string;
  updated_at: string;
}

export interface StoryClusterWithArticles {
  cluster: StoryCluster;
  articles: Article[];
}

export interface ProviderConfigInfo {
  id: string;
  name: string;
  has_key: boolean;
  masked_key: string;
  active_model: string;
  available_models: string[];
}

export interface MultiAiConfigInfo {
  active_provider: string;
  providers: ProviderConfigInfo[];
  explanation_mode: string;
  briefing_length: string;
}

export interface AiConfigInfo {
  has_key: boolean;
  masked_key: string;
  model: string;
  explanation_mode: string;
  briefing_length: string;
}

export interface AiAnswer {
  question: string;
  answer: string;
  simple_explanation?: string | null;
  decision_explanation?: string | null;
  sources: Article[];
  model_used: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  provider: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  sources_json?: string | null;
  created_at: string;
}

export interface AssistantReply {
  conversation_id: number;
  message_id: number;
  role: string;
  content: string;
  sources: Article[];
  provider: string;
  model: string;
  created_at: string;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  high: number;
  low: number;
  open: number;
  previous_close: number;
  timestamp: string;
  is_delayed: boolean;
  provider: string;
  sparkline: number[];
}

export interface FinanceConfig {
  has_key: boolean;
  masked_key: string;
  provider: string;
  watchlist: string[];
}

export interface NotificationPreferences {
  enabled: boolean;
  breaking: boolean;
  briefings: boolean;
  finance: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export interface StorageBreakdown {
  db_path: string;
  file_size_bytes: number;
  file_size_mb: number;
  article_count: number;
  briefing_count: number;
  conversation_count: number;
  message_count: number;
  notification_count: number;
  source_count: number;
}

export interface CleanupResult {
  deleted_articles: number;
  deleted_notifications: number;
  freed_bytes: number;
}

export interface ProcessMetrics {
  ram_working_set_mb: number;
  ram_peak_working_set_mb: number;
  cpu_time_seconds: number;
  uptime_seconds: number;
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
    publisher?: string,
    search?: string,
    sortBy?: string,
    limit?: number,
    offset?: number
  ): Promise<Article[]> {
    return call<Article[]>("db_get_articles_paginated", {
      category: category ?? null,
      publisher: publisher ?? null,
      search: search ?? null,
      sortBy: sortBy ?? null,
      limit: limit ?? null,
      offset: offset ?? null,
    });
  },

  async getPublishers(): Promise<string[]> {
    return call<string[]>("db_get_publishers");
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

  // ── Multi-Provider AI Intelligence ─────────────────────────────────────────
  async getAiConfig(): Promise<AiConfigInfo> {
    return call<AiConfigInfo>("ai_get_config");
  },

  async getMultiAiConfig(): Promise<MultiAiConfigInfo> {
    return call<MultiAiConfigInfo>("ai_get_providers_config");
  },

  async saveMultiAiConfig(config: {
    activeProvider?: string;
    provider?: string;
    apiKey?: string;
    model?: string;
    explanationMode?: string;
    briefingLength?: string;
  }): Promise<void> {
    return call<void>("ai_save_provider_config", {
      activeProvider: config.activeProvider ?? null,
      provider: config.provider ?? null,
      apiKey: config.apiKey ?? null,
      model: config.model ?? null,
      explanationMode: config.explanationMode ?? null,
      briefingLength: config.briefingLength ?? null,
    });
  },

  async saveAiConfig(config: {
    apiKey?: string;
    model?: string;
    explanationMode?: string;
    briefingLength?: string;
  }): Promise<void> {
    return call<void>("ai_save_config", {
      apiKey: config.apiKey ?? null,
      model: config.model ?? null,
      explanationMode: config.explanationMode ?? null,
      briefingLength: config.briefingLength ?? null,
    });
  },

  async testAiConnection(): Promise<string> {
    return call<string>("ai_test_connection");
  },

  async testProviderConnection(provider?: string): Promise<string> {
    return call<string>("ai_test_provider_connection", {
      provider: provider ?? null,
    });
  },

  async processNewsIntelligence(
    category?: string,
    limit?: number,
    forceRefresh?: boolean
  ): Promise<StoryClusterWithArticles[]> {
    return call<StoryClusterWithArticles[]>("ai_process_news", {
      category: category ?? null,
      limit: limit ?? null,
      forceRefresh: forceRefresh ?? null,
    });
  },

  async getAiStories(
    category?: string,
    search?: string,
    sortBy?: string,
    limit?: number
  ): Promise<StoryClusterWithArticles[]> {
    return call<StoryClusterWithArticles[]>("ai_get_stories", {
      category: category ?? null,
      search: search ?? null,
      sortBy: sortBy ?? null,
      limit: limit ?? null,
    });
  },

  async generateBriefing(
    briefingType: string,
    briefingLength: string
  ): Promise<Briefing> {
    return call<Briefing>("ai_generate_briefing", {
      briefingType,
      briefingLength,
    });
  },

  async getBriefings(
    briefingType?: string,
    search?: string,
    limit?: number
  ): Promise<Briefing[]> {
    return call<Briefing[]>("ai_get_briefings", {
      briefingType: briefingType ?? null,
      search: search ?? null,
      limit: limit ?? null,
    });
  },

  async askQuestion(question: string, storyContext?: string): Promise<AiAnswer> {
    return call<AiAnswer>("ai_ask_question", {
      question,
      storyContext: storyContext ?? null,
    });
  },

  // ── Conversational Assistant ──────────────────────────────────────────────
  async sendAssistantMessage(
    message: string,
    conversationId?: number
  ): Promise<AssistantReply> {
    return call<AssistantReply>("assistant_send_message", {
      conversationId: conversationId ?? null,
      message,
    });
  },

  async getConversations(limit?: number): Promise<Conversation[]> {
    return call<Conversation[]>("assistant_get_conversations", {
      limit: limit ?? null,
    });
  },

  async getConversationMessages(conversationId: number): Promise<ConversationMessage[]> {
    return call<ConversationMessage[]>("assistant_get_messages", {
      conversationId,
    });
  },

  async createConversation(title: string): Promise<number> {
    return call<number>("assistant_create_conversation", { title });
  },

  async deleteConversation(conversationId: number): Promise<void> {
    return call<void>("assistant_delete_conversation", { conversationId });
  },

  // ── Finance Intelligence ──────────────────────────────────────────────────
  async getFinanceConfig(): Promise<FinanceConfig> {
    return call<FinanceConfig>("finance_get_config");
  },

  async saveFinanceConfig(config: {
    apiKey?: string;
    provider?: string;
  }): Promise<void> {
    return call<void>("finance_save_config", {
      apiKey: config.apiKey ?? null,
      provider: config.provider ?? null,
    });
  },

  async getFinanceQuote(symbol: string): Promise<StockQuote> {
    return call<StockQuote>("finance_get_quote", { symbol });
  },

  async getWatchlistQuotes(symbols?: string[]): Promise<StockQuote[]> {
    return call<StockQuote[]>("finance_get_watchlist_quotes", {
      symbols: symbols ?? null,
    });
  },

  async saveWatchlist(symbols: string[]): Promise<void> {
    return call<void>("finance_save_watchlist", { symbols });
  },

  // ── Desktop Notifications ─────────────────────────────────────────────────
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    return call<NotificationPreferences>("notification_get_preferences");
  },

  async saveNotificationPreferences(
    preferences: NotificationPreferences
  ): Promise<void> {
    return call<void>("notification_save_preferences", { preferences });
  },

  async sendDesktopNotification(
    title: string,
    body: string,
    topic: string,
    force?: boolean
  ): Promise<boolean> {
    return call<boolean>("notification_send", {
      title,
      body,
      topic,
      force: force ?? null,
    });
  },

  // ── Database & Storage Management ─────────────────────────────────────────
  async getStorageBreakdown(): Promise<StorageBreakdown> {
    return call<StorageBreakdown>("db_get_storage_breakdown");
  },

  async clearTemporaryCache(): Promise<CleanupResult> {
    return call<CleanupResult>("db_clear_temporary_cache");
  },

  async backupDatabase(destPath?: string): Promise<string> {
    return call<string>("db_backup_database", {
      destPath: destPath ?? null,
    });
  },

  async restoreDatabase(backupFilePath: string): Promise<void> {
    return call<void>("db_restore_database", {
      backupFilePath,
    });
  },

  // ── Speech to Text (Whisper) ─────────────────────────────────────────────
  async transcribeAudio(bytes: number[], mimeType?: string): Promise<string> {
    return call<string>("ai_transcribe_audio", {
      bytes,
      mimeType: mimeType ?? null,
    });
  },

  // ── System & Process Telemetry ───────────────────────────────────────────
  async getProcessMetrics(): Promise<ProcessMetrics> {
    return call<ProcessMetrics>("system_get_process_metrics");
  },
};
