import { invoke } from "@tauri-apps/api/core";
import type { SystemInfo, AppStatus, WindowGeometry, AppError, UserPreferences } from "../types/desktop";
import { DEFAULT_PREFERENCES } from "../types/desktop";

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

  /**
   * Hides the native desktop floating window.
   */
  async hideWindow(): Promise<void> {
    if (!isTauriEnvironment()) {
      console.info("[Web Preview] hideWindow invoked (window hidden in native mode)");
      return;
    }

    try {
      await invoke("hide_window");
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Shows and focuses the native desktop floating window.
   */
  async showWindow(): Promise<void> {
    if (!isTauriEnvironment()) {
      console.info("[Web Preview] showWindow invoked");
      return;
    }

    try {
      await invoke("show_window");
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Retrieves native window dimensions and coordinates.
   */
  async getWindowGeometry(): Promise<WindowGeometry> {
    if (!isTauriEnvironment()) {
      return {
        width: 360,
        height: 48,
        x: Math.round((window.screen.availWidth - 360) / 2),
        y: 12,
        scale_factor: window.devicePixelRatio || 1,
      };
    }

    try {
      return await invoke<WindowGeometry>("get_window_geometry");
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Updates the native window size and position for Dynamic Island states:
   * "collapsed" (360x48), "expanded" (680x520), or "settings" (780x560).
   */
  async setIslandGeometry(state: "collapsed" | "expanded" | "settings"): Promise<void> {
    if (!isTauriEnvironment()) {
      console.info(`[Web Preview] Island geometry set to '${state}'`);
      return;
    }

    try {
      await invoke("set_island_geometry", { state });
    } catch (err) {
      console.warn("Failed to set island geometry:", err);
    }
  },

  /**
   * Dynamically configures a custom global keyboard shortcut.
   */
  async registerShortcut(shortcutStr: string): Promise<void> {
    if (!isTauriEnvironment()) {
      console.info(`[Web Preview] Shortcut registered: '${shortcutStr}'`);
      return;
    }

    try {
      await invoke("register_shortcut", { shortcutStr });
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Checks whether a global shortcut is currently registered.
   */
  async isShortcutRegistered(shortcutStr: string): Promise<boolean> {
    if (!isTauriEnvironment()) {
      return true;
    }

    try {
      return await invoke<boolean>("is_shortcut_registered", { shortcutStr });
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Fetches persisted user preferences from native disk storage.
   */
  async getPreferences(): Promise<UserPreferences> {
    if (!isTauriEnvironment()) {
      const stored = localStorage.getItem("nexora_preferences");
      if (stored) {
        try {
          return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
        } catch {}
      }
      return DEFAULT_PREFERENCES;
    }

    try {
      const prefs = await invoke<UserPreferences>("get_preferences");
      localStorage.setItem("nexora_preferences", JSON.stringify(prefs));
      return prefs;
    } catch (err) {
      console.warn("Failed to load native preferences, using fallback:", err);
      const stored = localStorage.getItem("nexora_preferences");
      if (stored) {
        try {
          return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
        } catch {}
      }
      return DEFAULT_PREFERENCES;
    }
  },

  /**
   * Persists user preferences to native disk storage.
   */
  async savePreferences(preferences: UserPreferences): Promise<void> {
    localStorage.setItem("nexora_preferences", JSON.stringify(preferences));

    if (!isTauriEnvironment()) {
      console.info("[Web Preview] Preferences saved to localStorage");
      return;
    }

    try {
      await invoke("save_preferences", { preferences });
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Configures Windows registry autostart for Orbit.
   */
  async setLaunchAtStartup(enabled: boolean): Promise<void> {
    if (!isTauriEnvironment()) {
      console.info(`[Web Preview] Autostart set to ${enabled}`);
      return;
    }

    try {
      await invoke("set_launch_at_startup", { enabled });
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Updates global keyboard shortcut with automatic fallback rollback on conflict.
   */
  async updateGlobalShortcut(newShortcutStr: string, previousShortcutStr: string): Promise<string> {
    if (!isTauriEnvironment()) {
      return `Simulated shortcut update to ${newShortcutStr}`;
    }

    try {
      return await invoke<string>("update_global_shortcut", {
        newShortcutStr,
        previousShortcutStr,
      });
    } catch (err) {
      throw normalizeError(err);
    }
  },
};

