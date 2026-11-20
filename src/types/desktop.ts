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
  | "daily-knowledge";

export interface CategoryItem {
  id: CategoryId;
  title: string;
  subtitle: string;
  tag: string;
  accent: string;
}


