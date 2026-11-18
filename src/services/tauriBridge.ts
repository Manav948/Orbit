import { invoke } from "@tauri-apps/api/core";
import type { SystemInfo, AppStatus, AppError } from "../types/desktop";

/**
 * Checks whether the application is running inside a Tauri window runtime.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Normalizes unknown errors into a standard structured AppError.
 */
export function normalizeError(err: unknown): AppError {
  const timestamp = new Date().toISOString();
  if (typeof err === "string") {
    return { message: err, timestamp };
  }
  if (err instanceof Error) {
    return { message: err.message, timestamp };
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    return {
      message: String((err as { message: unknown }).message),
      code: "code" in err ? String((err as { code: unknown }).code) : undefined,
      timestamp,
    };
  }
  return {
    message: "An unknown error occurred while communicating with native desktop service.",
    timestamp,
  };
}

/**
 * Tauri IPC bridge service providing typed native desktop capabilities.
 */
export const tauriBridge = {
  /**
   * Fetches host system and architecture information.
   */
  async getSystemInfo(): Promise<SystemInfo> {
    if (!isTauriEnvironment()) {
      return {
        os: "Windows (Web Preview)",
        arch: "x86_64",
        app_version: "0.1.0",
        tauri_version: "2.0 (Host Pending)",
        status: "Development Browser Standalone",
      };
    }

    try {
      return await invoke<SystemInfo>("get_system_info");
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Fetches desktop runtime initialization status.
   */
  async getAppStatus(): Promise<AppStatus> {
    if (!isTauriEnvironment()) {
      return {
        initialized: true,
        runtime_mode: "Vite Standalone",
        timestamp_ms: Date.now(),
      };
    }

    try {
      return await invoke<AppStatus>("get_app_status");
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Sends a ping message to the native Rust desktop backend.
   */
  async ping(message: string): Promise<string> {
    if (!isTauriEnvironment()) {
      const trimmed = message.trim();
      if (!trimmed) {
        throw normalizeError("Payload cannot be empty. Please provide a message.");
      }
      return `Standalone Web Mode acknowledged: '${trimmed}'`;
    }

    try {
      return await invoke<string>("ping", { message });
    } catch (err) {
      throw normalizeError(err);
    }
  },
};

