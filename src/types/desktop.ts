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

