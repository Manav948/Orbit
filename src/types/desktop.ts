export interface SystemInfo {
  os: string;
  arch: string;
  app_version: string;
  tauri_version: string;
  status: string;
}

export interface AppStatus {
  initialized: boolean;
  runtime_mode: string;
  timestamp_ms: number;
}

export interface WindowGeometry {
  width: number;
  height: number;
  x: number;
  y: number;
  scale_factor: number;
}

export interface AppError {
  message: string;
  code?: string;
  timestamp: string;
}

export type AsyncState<T> =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: T | null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: T | null; error: AppError };

export type CategoryId =
  | "world-news"
  | "finance-markets"
  | "technology-ai"
  | "daily-knowledge"
  | "business"
  | "science";

export type ThemeMode = "dark" | "light" | "system";
export type AccentColor = "amber" | "cyber" | "emerald" | "violet";
export type CloseBehavior = "tray" | "minimize" | "exit";

export interface CategoriesPreferences {
  world_news: boolean;
  finance_markets: boolean;
  technology_ai: boolean;
  daily_knowledge: boolean;
  business: boolean;
  science: boolean;
}

export interface NotificationsPreferences {
  breaking_news: boolean;
  daily_briefing: boolean;
  market_alerts: boolean;
  sound_enabled: boolean;
}

export interface UserPreferences {
  launch_at_startup: boolean;
  start_minimized: boolean;
  close_behavior: CloseBehavior;
  auto_check_updates: boolean;

  theme: ThemeMode;
  accent_color: AccentColor;
  island_scale: number;
  enable_animations: boolean;
  glass_blur: "light" | "medium" | "strong";
  default_island_mode: "collapsed" | "expanded";

  global_shortcut: string;

  categories: CategoriesPreferences;
  notifications: NotificationsPreferences;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  launch_at_startup: false,
  start_minimized: false,
  close_behavior: "tray",
  auto_check_updates: true,

  theme: "dark",
  accent_color: "amber",
  island_scale: 100,
  enable_animations: true,
  glass_blur: "strong",
  default_island_mode: "collapsed",

  global_shortcut: "Alt+Space",

  categories: {
    world_news: true,
    finance_markets: true,
    technology_ai: true,
    daily_knowledge: true,
    business: true,
    science: true,
  },

  notifications: {
    breaking_news: true,
    daily_briefing: true,
    market_alerts: false,
    sound_enabled: true,
  },
};

export interface CategoryItem {
  id: CategoryId;
  title: string;
  subtitle: string;
  tag: string;
  accent: string;
}



