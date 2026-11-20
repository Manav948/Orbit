import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  UserPreferences,
  ThemeMode,
  AccentColor,
  CloseBehavior,
  CategoriesPreferences,
  NotificationsPreferences,
} from "../types/desktop";
import { DEFAULT_PREFERENCES } from "../types/desktop";
import { tauriBridge } from "../services/tauriBridge";
import { getAccentConfig, type AccentThemeConfig } from "../utils/accentThemes";

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load preferences on component mount
  useEffect(() => {
    let mounted = true;
    tauriBridge
      .getPreferences()
      .then((loaded) => {
        if (mounted) {
          setPreferences(loaded);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Could not load preferences, using defaults:", err);
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Synchronize Theme, Accent, Animations, and Island Scale to DOM
  useEffect(() => {
    const root = document.documentElement;

    // 1. Theme application (dark / light / system)
    const applyTheme = (theme: ThemeMode) => {
      if (theme === "system") {
        const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("dark", isSystemDark);
        root.dataset.theme = isSystemDark ? "dark" : "light";
      } else {
        root.classList.toggle("dark", theme === "dark");
        root.dataset.theme = theme;
      }
    };

    applyTheme(preferences.theme);

    // If system theme is selected, listen for OS theme changes
    if (preferences.theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
        root.dataset.theme = e.matches ? "dark" : "light";
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [preferences.theme]);

  useEffect(() => {
    const root = document.documentElement;

    // 2. Accent color data-attribute
    root.setAttribute("data-accent", preferences.accent_color);

    // 3. Animation preference
    root.setAttribute("data-animations", String(preferences.enable_animations));

  }, [preferences.accent_color, preferences.enable_animations]);

  // Persist updated preferences to state and native backend
  const savePreferences = useCallback(async (nextPrefs: UserPreferences) => {
    setPreferences(nextPrefs);
    try {
      await tauriBridge.savePreferences(nextPrefs);
    } catch (err) {
      console.error("Failed to persist user preferences:", err);
    }
  }, []);

  // Update arbitrary partial preferences
  const updatePreferences = useCallback(
    async (partial: Partial<UserPreferences>) => {
      const next: UserPreferences = {
        ...preferences,
        ...partial,
      };
      await savePreferences(next);
    },
    [preferences, savePreferences]
  );

  // General Settings
  const setLaunchAtStartup = useCallback(
    async (enabled: boolean) => {
      const next = { ...preferences, launch_at_startup: enabled };
      await savePreferences(next);
      try {
        await tauriBridge.setLaunchAtStartup(enabled);
      } catch (err) {
        console.warn("Could not configure registry autostart:", err);
      }
    },
    [preferences, savePreferences]
  );

  const setStartMinimized = useCallback(
    async (enabled: boolean) => {
      await updatePreferences({ start_minimized: enabled });
    },
    [updatePreferences]
  );

  const setCloseBehavior = useCallback(
    async (behavior: CloseBehavior) => {
      await updatePreferences({ close_behavior: behavior });
    },
    [updatePreferences]
  );

  const setAutoCheckUpdates = useCallback(
    async (enabled: boolean) => {
      await updatePreferences({ auto_check_updates: enabled });
    },
    [updatePreferences]
  );

  // Appearance Settings
  const setTheme = useCallback(
    async (theme: ThemeMode) => {
      await updatePreferences({ theme });
    },
    [updatePreferences]
  );

  const setAccentColor = useCallback(
    async (accent_color: AccentColor) => {
      await updatePreferences({ accent_color });
    },
    [updatePreferences]
  );

  const setEnableAnimations = useCallback(
    async (enable_animations: boolean) => {
      await updatePreferences({ enable_animations });
    },
    [updatePreferences]
  );

  const setDefaultIslandMode = useCallback(
    async (default_island_mode: "collapsed" | "expanded") => {
      await updatePreferences({ default_island_mode });
    },
    [updatePreferences]
  );

  // Intelligence Categories Toggles
  const toggleCategory = useCallback(
    async (categoryKey: keyof CategoriesPreferences) => {
      const updatedCategories: CategoriesPreferences = {
        ...preferences.categories,
        [categoryKey]: !preferences.categories[categoryKey],
      };
      await updatePreferences({ categories: updatedCategories });
    },
    [preferences.categories, updatePreferences]
  );

  // Notifications Toggles
  const toggleNotification = useCallback(
    async (notificationKey: keyof NotificationsPreferences) => {
      const updatedNotifications: NotificationsPreferences = {
        ...preferences.notifications,
        [notificationKey]: !preferences.notifications[notificationKey],
      };
      await updatePreferences({ notifications: updatedNotifications });
    },
    [preferences.notifications, updatePreferences]
  );

  // Keyboard Shortcut Management with Conflict Rollback
  const updateShortcut = useCallback(
    async (
      newShortcut: string
    ): Promise<{ success: boolean; message: string }> => {
      const trimmed = newShortcut.trim();
      if (!trimmed) {
        return { success: false, message: "Shortcut cannot be empty." };
      }

      // Basic structure validation: check for modifiers and main key
      const parts = trimmed.split("+").map((p) => p.trim());
      const modifiers = ["alt", "ctrl", "control", "shift", "super", "win", "meta", "command"];
      const hasModifier = parts.some((part) => modifiers.includes(part.toLowerCase()));
      const hasMainKey = parts.some((part) => part && !modifiers.includes(part.toLowerCase()));

      if (parts.some((part) => !part) || !hasModifier || !hasMainKey) {
        return {
          success: false,
          message: "Enter a valid shortcut with one key and at least one modifier, such as Alt+Space or Ctrl+Shift+K.",
        };
      }

      const previous = preferences.global_shortcut;
      try {
        const resultMsg = await tauriBridge.updateGlobalShortcut(trimmed, previous);
        const next: UserPreferences = {
          ...preferences,
          global_shortcut: trimmed,
        };
        await savePreferences(next);
        return { success: true, message: resultMsg || `Registered ${trimmed}` };
      } catch (err: unknown) {
        const errorMsg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to register shortcut with Windows. Previous shortcut retained.";
        return { success: false, message: errorMsg };
      }
    },
    [preferences, savePreferences]
  );

  const restoreDefaultShortcut = useCallback(async () => {
    return await updateShortcut("Alt+Space");
  }, [updateShortcut]);

  // Reset all preferences
  const resetAllPreferences = useCallback(async () => {
    await savePreferences(DEFAULT_PREFERENCES);
    try {
      await tauriBridge.updateGlobalShortcut(
        DEFAULT_PREFERENCES.global_shortcut,
        preferences.global_shortcut
      );
    } catch {}
  }, [preferences.global_shortcut, savePreferences]);

  // Compute active accent configuration
  const activeAccent: AccentThemeConfig = useMemo(() => {
    return getAccentConfig(preferences.accent_color);
  }, [preferences.accent_color]);

  return {
    preferences,
    isLoading,
    accent: activeAccent,
    savePreferences,
    updatePreferences,
    setLaunchAtStartup,
    setStartMinimized,
    setCloseBehavior,
    setAutoCheckUpdates,
    setTheme,
    setAccentColor,
    setEnableAnimations,
    setDefaultIslandMode,
    toggleCategory,
    toggleNotification,
    updateShortcut,
    restoreDefaultShortcut,
    resetAllPreferences,
  };
}

