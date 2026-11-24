import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CollapsedIsland } from "./components/DynamicIsland/CollapsedIsland";
import { ExpandedIsland } from "./components/DynamicIsland/ExpandedIsland";
import { SettingsPage } from "./components/Settings/SettingsPage";
import { useDesktopStatus } from "./hooks/useDesktopStatus";
import { usePreferences } from "./hooks/usePreferences";
import { tauriBridge, isTauriEnvironment } from "./services/tauriBridge";

export type IslandMode = "collapsed" | "expanded" | "settings";

export function App() {
  const { systemInfo, appStatus, windowGeometry } = useDesktopStatus();
  const {
    preferences,
    isLoading: preferencesLoading,
    accent,
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
  } = usePreferences();

  const [mode, setMode] = useState<IslandMode | null>(null);
  const [webNotice, setWebNotice] = useState(false);
  const startupModeApplied = useRef(false);

  // Transition helper that coordinates UI state and native OS window sizing
  const transitionTo = useCallback(async (newMode: IslandMode) => {
    setMode(newMode);
    await tauriBridge.setIslandGeometry(newMode);
  }, []);

  // Apply the saved startup mode once preferences have loaded.
  useEffect(() => {
    if (preferencesLoading || startupModeApplied.current) return;
    startupModeApplied.current = true;
    void transitionTo(preferences.default_island_mode);
  }, [preferencesLoading, preferences.default_island_mode, transitionTo]);

  const handleExpand = () => transitionTo("expanded");
  const handleCollapse = () => transitionTo("collapsed");
  const handleOpenSettings = () => transitionTo("settings");
  const handleBackToIsland = () => transitionTo("collapsed");

  const handleCloseWindow = async () => {
    if (!isTauriEnvironment()) {
      setWebNotice(true);
      return;
    }
    await tauriBridge.hideWindow();
  };

  // Listen for native system tray "Settings" event
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    let unlisten: (() => void) | undefined;
    let unlistenSettings: (() => void) | undefined;
    Promise.all([
      listen<string>("open-island", (event) => {
        transitionTo(event.payload === "expanded" ? "expanded" : "collapsed");
      }),
      listen("open-settings", () => {
        transitionTo("settings");
      }),
    ]).then(([stopIsland, stopSettings]) => {
      unlisten = stopIsland;
      unlistenSettings = stopSettings;
    });
    return () => {
      unlisten?.();
      unlistenSettings?.();
    };
  }, [transitionTo]);

  // Global Keyboard Handlers (Escape collapses or returns to island)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode === "expanded" || mode === "settings") {
          transitionTo("collapsed");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, transitionTo]);

  // If window loses focus while expanded, collapse to compact pill
  useEffect(() => {
    const handleBlur = () => {
      if (mode === "expanded") {
        transitionTo("collapsed");
      }
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [mode, transitionTo]);

  return (
    <TooltipProvider>
      <div
        onClick={() => {
          // Clicking in the transparent background area outside the island collapses it
          if (mode === "expanded") {
            handleCollapse();
          }
        }}
        className="w-screen h-screen flex flex-col items-center justify-start p-1.5 box-border bg-transparent select-none overflow-hidden"
      >
        {/* Web browser mode banner */}
        {webNotice && (
          <div className="mb-2 p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300 flex items-center space-x-2">
            <span>[Desktop Simulation] Window hidden to tray in native mode.</span>
            <button
              onClick={() => setWebNotice(false)}
              className="text-white underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Mode 1: Collapsed Dynamic Island Pill ────────────────────────── */}
        {mode === "collapsed" && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <CollapsedIsland onExpand={handleExpand} />
          </div>
        )}

        {/* ── Mode 2: Expanded Dynamic Island Panel ───────────────────────── */}
        {mode === "expanded" && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-250">
            <ExpandedIsland
              onCollapse={handleCollapse}
              onOpenSettings={handleOpenSettings}
              onCloseWindow={handleCloseWindow}
              preferences={preferences}
              accent={accent}
            />
          </div>
        )}

        {/* ── Mode 3: Full Settings Interface ─────────────────────────────── */}
        {mode === "settings" && (
          <div>
            <SettingsPage
              onBackToIsland={handleBackToIsland}
              systemInfo={systemInfo}
              appStatus={appStatus}
              windowGeometry={windowGeometry}
              preferences={preferences}
              accent={accent}
              onSetLaunchAtStartup={setLaunchAtStartup}
              onSetStartMinimized={setStartMinimized}
              onSetCloseBehavior={setCloseBehavior}
              onSetAutoCheckUpdates={setAutoCheckUpdates}
              onSetTheme={setTheme}
              onSetAccentColor={setAccentColor}
              onSetEnableAnimations={setEnableAnimations}
              onSetDefaultIslandMode={setDefaultIslandMode}
              onToggleCategory={toggleCategory}
              onToggleNotification={toggleNotification}
              onUpdateShortcut={updateShortcut}
              onRestoreDefaultShortcut={restoreDefaultShortcut}
              onResetAllPreferences={resetAllPreferences}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default App;
