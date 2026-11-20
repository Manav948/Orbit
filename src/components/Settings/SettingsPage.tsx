import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import {
  Sliders,
  Palette,
  Keyboard,
  Sparkles,
  Bell,
  Info,
  ArrowLeft,
  X,
  Check,
  RotateCcw,
  Globe,
  TrendingUp,
  Cpu,
  BookOpen,
  Briefcase,
  Microscope,
  AlertCircle,
  Volume2,
  VolumeX,
  Laptop,
  Moon,
  Sun,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { OrbitLogo } from "../icons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { tauriBridge } from "../../services/tauriBridge";
import type {
  SystemInfo,
  AppStatus,
  WindowGeometry,
  ThemeMode,
  AccentColor,
  CloseBehavior,
  UserPreferences,
  CategoriesPreferences,
  NotificationsPreferences,
} from "../../types/desktop";
import { ACCENT_THEMES, type AccentThemeConfig } from "../../utils/accentThemes";

interface SettingsPageProps {
  onBackToIsland: () => void;
  systemInfo: SystemInfo | null;
  appStatus: AppStatus | null;
  windowGeometry: WindowGeometry | null;
  preferences: UserPreferences;
  accent: AccentThemeConfig;
  onSetLaunchAtStartup: (enabled: boolean) => Promise<void>;
  onSetStartMinimized: (enabled: boolean) => Promise<void>;
  onSetCloseBehavior: (behavior: CloseBehavior) => Promise<void>;
  onSetAutoCheckUpdates: (enabled: boolean) => Promise<void>;
  onSetTheme: (theme: ThemeMode) => Promise<void>;
  onSetAccentColor: (accent: AccentColor) => Promise<void>;
  onSetEnableAnimations: (enabled: boolean) => Promise<void>;
  onSetDefaultIslandMode: (mode: "collapsed" | "expanded") => Promise<void>;
  onToggleCategory: (cat: keyof CategoriesPreferences) => Promise<void>;
  onToggleNotification: (notif: keyof NotificationsPreferences) => Promise<void>;
  onUpdateShortcut: (newShortcut: string) => Promise<{ success: boolean; message: string }>;
  onRestoreDefaultShortcut: () => Promise<{ success: boolean; message: string }>;
  onResetAllPreferences: () => Promise<void>;
}

export type SettingsTab =
  | "general"
  | "appearance"
  | "shortcuts"
  | "categories"
  | "notifications"
  | "about";

export function SettingsPage({
  onBackToIsland,
  systemInfo,
  appStatus,
  windowGeometry,
  preferences,
  accent,
  onSetLaunchAtStartup,
  onSetStartMinimized,
  onSetCloseBehavior,
  onSetAutoCheckUpdates,
  onSetTheme,
  onSetAccentColor,
  onSetEnableAnimations,
  onSetDefaultIslandMode,
  onToggleCategory,
  onToggleNotification,
  onUpdateShortcut,
  onRestoreDefaultShortcut,
  onResetAllPreferences,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  // Shortcut Recording State
  const [shortcutInput, setShortcutInput] = useState(preferences.global_shortcut);
  const [isRecording, setIsRecording] = useState(false);
  const [shortcutFeedback, setShortcutFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const recordInputRef = useRef<HTMLInputElement>(null);

  // Sync shortcut input when preferences change from external source
  useEffect(() => {
    setShortcutInput(preferences.global_shortcut);
  }, [preferences.global_shortcut]);

  // Diagnostic Ping State
  const [pingInput, setPingInput] = useState("Orbit Diagnostic Ping");
  const [pingResponse, setPingResponse] = useState<string | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Reset Confirmation State
  const [confirmReset, setConfirmReset] = useState(false);

  // Handle keypresses during shortcut recording
  const handleKeyDownRecording = (e: KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent Esc from being captured as shortcut key; Esc cancels recording
    if (e.key === "Escape") {
      setIsRecording(false);
      setShortcutInput(preferences.global_shortcut);
      setShortcutFeedback({
        type: "info",
        message: "Recording cancelled. Original shortcut preserved.",
      });
      return;
    }

    // Identify modifiers
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Super");

    // Filter out standalone modifier key presses (e.g. user just hit Alt alone)
    const ignoredKeys = ["Control", "Alt", "Shift", "Meta", "CapsLock", "Tab"];
    if (!ignoredKeys.includes(e.key)) {
      let keyName = e.key;
      if (keyName === " ") keyName = "Space";
      else if (keyName.length === 1) keyName = keyName.toUpperCase();

      parts.push(keyName);
      const combined = parts.join("+");
      setShortcutInput(combined);
      setIsRecording(false);
      setShortcutFeedback({
        type: "info",
        message: `Captured '${combined}'. Click 'Apply & Save' to test and register.`,
      });
    }
  };

  const handleApplyShortcut = async () => {
    setIsSavingShortcut(true);
    setShortcutFeedback(null);
    try {
      const result = await onUpdateShortcut(shortcutInput);
      setShortcutFeedback({
        type: result.success ? "success" : "error",
        message: result.message || (result.success
          ? `Successfully registered '${shortcutInput}'!`
          : "Could not register this shortcut. Check the key combination and try again."),
      });
    } catch (err) {
      setShortcutFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Could not register this shortcut. Try a different key combination.",
      });
    } finally {
      setIsSavingShortcut(false);
    }
  };

  const handleRestoreDefault = async () => {
    setIsSavingShortcut(true);
    setShortcutFeedback(null);
    try {
      const result = await onRestoreDefaultShortcut();
      if (result.success) setShortcutInput("Alt+Space");
      setShortcutFeedback({
        type: result.success ? "success" : "error",
        message: result.success
          ? "Restored default global shortcut: Alt+Space."
          : result.message || "Could not restore Alt+Space. Try applying it again.",
      });
    } catch (err) {
      setShortcutFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Could not restore Alt+Space. Try again.",
      });
    } finally {
      setIsSavingShortcut(false);
    }
  };

  const handleTestPing = async (e: FormEvent) => {
    e.preventDefault();
    setIsPinging(true);
    setPingError(null);
    setPingResponse(null);
    try {
      const res = await tauriBridge.ping(pingInput);
      setPingResponse(res);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setPingError(String((err as { message: unknown }).message));
      } else {
        setPingError("Diagnostic ping failed");
      }
    } finally {
      setIsPinging(false);
    }
  };

  const navItems: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: "general", label: "General", icon: <Sliders className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "shortcuts", label: "Keyboard Shortcuts", icon: <Keyboard className="w-4 h-4" /> },
    { id: "categories", label: "Intelligence Categories", icon: <Sparkles className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "about", label: "About Orbit", icon: <Info className="w-4 h-4" /> },
  ];

  // Count active intelligence feeds
  const activeCategoriesCount = Object.values(preferences.categories).filter(Boolean).length;
  const totalCategoriesCount = Object.keys(preferences.categories).length;

  return (
    <Card
      onClick={(e) => e.stopPropagation()}
      className="w-[760px] h-[540px] p-0 gap-0 flex flex-col bg-[#07080a]/98 border-white/[0.09] rounded-3xl shadow-2xl shadow-black/95 overflow-hidden backdrop-blur-2xl text-neutral-200 select-none ring-1 ring-white/[0.04]"
    >
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent cursor-move"
      >
        <div className="flex items-center space-x-3" data-tauri-drag-region="false">
          <Button
            variant="outline"
            size="icon-xs"
            onClick={onBackToIsland}
            aria-label="Back to island"
            title="Back to island"
            className={`h-7 w-7 bg-white/[0.04] ${accent.bgSubtle} border-white/[0.08] ${accent.borderSubtle} text-neutral-200 ${accent.textLight} rounded-xl cursor-pointer`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>

        </div>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onBackToIsland}
                className="text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-lg"
              />
            }
          >
            <X className="w-3.5 h-3.5" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Close Settings (Esc)</TooltipContent>
        </Tooltip>
      </div>

      {/* ── Two-Column Layout ──────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar Navigation */}
        <div className="w-56 p-3 border-r border-white/[0.06] bg-black/30 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <div className={`w-5 h-5 rounded-full ${accent.bgSubtle} border ${accent.borderSubtle} flex items-center justify-center ${accent.text}`}>
                <OrbitLogo className="w-3 h-3" />
              </div>
              <h1 className="text-xs font-semibold text-white tracking-tight">Settings</h1>
            </div>
            <Separator
              className="my-2 h-px bg-neutral-300 dark:bg-white/15"
              style={{ width: "calc(100% + 24px)", marginLeft: "-12px" }}
            />
            <div className="space-y-1">
              {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => setActiveTab(item.id)}
                  className={`group w-full flex flex-row items-center justify-start gap-2.5 h-8 px-3 text-left text-xs font-medium rounded-xl transition-all ${
                    active
                      ? "!bg-white hover:!bg-white focus-visible:!bg-white border-white !text-neutral-950 hover:!text-neutral-950 focus-visible:!text-neutral-950 font-semibold"
                      : "text-neutral-400 hover:!text-neutral-400 hover:!bg-transparent"
                  }`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center ${active ? "text-neutral-950" : "text-neutral-500"}`}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                </Button>
              );
              })}
            </div>
          </div>

          {/* Quick Telemetry Footnote */}
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[10px] text-neutral-500 space-y-0.5">
            <div className="font-medium text-neutral-400 flex items-center justify-between">
              <span>Orbit Core v0.1.0</span>
              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
            </div>
            <div>Tauri 2 • Windows Native Top-Center</div>
          </div>
        </div>

        {/* Content Pane with shadcn ScrollArea */}
        <ScrollArea className="flex-1 min-w-0">
          <div className="min-h-full p-5">
          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 1. GENERAL TAB                                                  */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === "general" && (
            <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">General Preferences</h2>
                <p className="text-[11px] text-neutral-400">
                  Control startup behavior, taskbar integration, and window lifecycle.
                </p>
              </div>

              <div className="space-y-2.5">
                {/* Windows Startup */}
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Launch Orbit on Windows Startup
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Automatically position the Dynamic Island top-center when logging into Windows.
                    </span>
                  </div>
                  <Switch
                    checked={preferences.launch_at_startup}
                    onCheckedChange={(checked) => onSetLaunchAtStartup(checked)}
                  />
                </Card>

                {/* Start Minimized */}
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Start Minimized to Tray
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Begin in the background without displaying the island until requested.
                    </span>
                  </div>
                  <Switch
                    checked={preferences.start_minimized}
                    onCheckedChange={(checked) => onSetStartMinimized(checked)}
                  />
                </Card>

                {/* Close Button Behavior */}
                <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2.5">
                  <div>
                    <span className="text-xs font-medium text-white block">
                      Close Button Behavior
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Determine what occurs when clicking the window close button.
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={preferences.close_behavior === "tray" ? "secondary" : "outline"}
                      onClick={() => onSetCloseBehavior("tray")}
                      className={`h-8 justify-start px-2.5 text-xs rounded-xl ${
                        preferences.close_behavior === "tray"
                          ? "!bg-white hover:!bg-white border-white !text-neutral-950 hover:!text-neutral-950 font-semibold"
                          : "bg-black/30 border-white/[0.06] text-neutral-400"
                      }`}
                    >
                      <span>Hide to Tray</span>
                    </Button>

                    <Button
                      type="button"
                      variant={preferences.close_behavior === "minimize" ? "secondary" : "outline"}
                      onClick={() => onSetCloseBehavior("minimize")}
                      className={`h-8 justify-start px-2.5 text-xs rounded-xl ${
                        preferences.close_behavior === "minimize"
                          ? "!bg-white hover:!bg-white border-white !text-neutral-950 hover:!text-neutral-950 font-semibold"
                          : "bg-black/30 border-white/[0.06] text-neutral-400"
                      }`}
                    >
                      <span>Minimize</span>
                    </Button>

                    <Button
                      type="button"
                      variant={preferences.close_behavior === "exit" ? "secondary" : "outline"}
                      onClick={() => onSetCloseBehavior("exit")}
                      className={`h-8 justify-start px-2.5 text-xs rounded-xl ${
                        preferences.close_behavior === "exit"
                          ? "!bg-white hover:!bg-white border-white !text-neutral-950 hover:!text-neutral-950 font-semibold"
                          : "bg-black/30 border-white/[0.06] text-neutral-400"
                      }`}
                    >
                      <span>Terminate App</span>
                    </Button>
                  </div>
                </Card>

                {/* Automatic Updates Placeholder */}
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-white">
                        Automatically Check for Updates
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      >
                        v0.1.0 Latest
                      </Badge>
                    </div>
                    <span className="text-[10px] text-neutral-400 block">
                      Periodically notify when new frontier intelligence capabilities are released.
                    </span>
                  </div>
                  <Switch
                    checked={preferences.auto_check_updates}
                    onCheckedChange={(checked) => onSetAutoCheckUpdates(checked)}
                  />
                </Card>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 2. APPEARANCE TAB                                               */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === "appearance" && (
            <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">Appearance & Theming</h2>
                <p className="text-[11px] text-neutral-400">
                  Personalize the visual aesthetics, theme mode, and accent colors.
                </p>
              </div>

              {/* Theme Mode Selection */}
              <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2.5">
                <div>
                  <span className="text-xs font-medium text-white block">Theme Mode</span>
                  <span className="text-[10px] text-neutral-400 block">
                    Choose between dark, light, or automatic system-synchronized theme.
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={preferences.theme === "dark" ? "secondary" : "outline"}
                    onClick={() => onSetTheme("dark")}
                    className={`h-8 justify-center px-3 text-xs gap-2 rounded-xl ${
                      preferences.theme === "dark"
                        ? `${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight} font-semibold`
                        : "bg-black/30 border-white/[0.06] text-neutral-400"
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Dark</span>
                  </Button>

                  <Button
                    type="button"
                    variant={preferences.theme === "light" ? "secondary" : "outline"}
                    onClick={() => onSetTheme("light")}
                    className={`h-8 justify-center px-3 text-xs gap-2 rounded-xl ${
                      preferences.theme === "light"
                        ? `${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight} font-semibold`
                        : "bg-black/30 border-white/[0.06] text-neutral-400"
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Light</span>
                  </Button>

                  <Button
                    type="button"
                    variant={preferences.theme === "system" ? "secondary" : "outline"}
                    onClick={() => onSetTheme("system")}
                    className={`h-8 justify-center px-3 text-xs gap-2 rounded-xl ${
                      preferences.theme === "system"
                        ? `${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight} font-semibold`
                        : "bg-black/30 border-white/[0.06] text-neutral-400"
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    <span>System</span>
                  </Button>
                </div>
              </Card>

              {/* Accent Palette Selection */}
              <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2.5">
                <div>
                  <span className="text-xs font-medium text-white block">Accent Palette</span>
                  <span className="text-[10px] text-neutral-400 block">
                    Defines the ambient highlight color used across the Dynamic Island and controls.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ACCENT_THEMES) as AccentColor[]).map((colKey) => {
                    const themeObj = ACCENT_THEMES[colKey];
                    const isSelected = preferences.accent_color === colKey;
                    return (
                      <Button
                        key={colKey}
                        type="button"
                        variant={isSelected ? "secondary" : "outline"}
                        onClick={() => onSetAccentColor(colKey)}
                        className={`h-9 justify-start px-3 text-xs gap-2.5 rounded-xl cursor-pointer ${
                          isSelected
                            ? `${themeObj.bgSubtle} border ${themeObj.borderActive} ${themeObj.textLight} font-semibold shadow-xs`
                            : "bg-black/30 border-white/[0.06] text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${themeObj.dot} shadow-xs`} />
                        <span className="flex-1 text-left">{themeObj.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </Button>
                    );
                  })}
                </div>
              </Card>

              {/* Default Island Mode & Animation Toggle */}
              <div className="grid grid-cols-2 gap-2.5">
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Default Startup State
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      {preferences.default_island_mode === "collapsed"
                        ? "Compact pill"
                        : "Expanded panel"}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      onSetDefaultIslandMode(
                        preferences.default_island_mode === "collapsed"
                          ? "expanded"
                          : "collapsed"
                      )
                    }
                    className="h-6 px-2 text-[10px] bg-black/40 border-white/[0.08]"
                  >
                    {preferences.default_island_mode === "collapsed"
                      ? "Pill"
                      : "Expanded"}
                  </Button>
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Smooth Animations
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Morphing and transitions
                    </span>
                  </div>
                  <Switch
                    checked={preferences.enable_animations}
                    onCheckedChange={(checked) => onSetEnableAnimations(checked)}
                  />
                </Card>
              </div>

            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 3. KEYBOARD SHORTCUTS TAB                                       */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === "shortcuts" && (
            <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts</h2>
                <p className="text-[11px] text-neutral-400">
                  Global hotkey configuration registered with Windows via Tauri 2.
                </p>
              </div>

              {/* Active global shortcut and editor */}
              <Card className="p-4 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Global toggle shortcut
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Use this shortcut anywhere to show or hide Orbit.
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`px-3 py-1 font-mono text-xs font-semibold ${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight}`}
                  >
                    {preferences.global_shortcut}
                  </Badge>
                </div>

                <Separator className="bg-white/[0.06]" />

                {/* Shortcut editor and actions */}
                <div className="space-y-2">
                  <label htmlFor="shortcut-recorder" className="text-[10px] font-medium text-neutral-400">
                    New shortcut
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Input
                        id="shortcut-recorder"
                        ref={recordInputRef}
                        type="text"
                        value={shortcutInput}
                        onChange={(e) => setShortcutInput(e.target.value)}
                        onKeyDown={isRecording ? handleKeyDownRecording : undefined}
                        placeholder="e.g. Alt+Space or Ctrl+Shift+N"
                        className={`h-9 text-xs font-mono bg-black/50 border-white/[0.1] rounded-xl text-neutral-200 ${
                          isRecording ? `border-amber-400 ring-2 ring-amber-400/30 text-amber-300 animate-pulse` : ""
                        }`}
                      />
                    </div>

                    <Button
                      type="button"
                      variant={isRecording ? "destructive" : "outline"}
                      onClick={() => {
                        setIsRecording(!isRecording);
                        if (!isRecording) {
                          setTimeout(() => recordInputRef.current?.focus(), 50);
                        }
                      }}
                      className="h-9 px-3 text-xs rounded-xl"
                    >
                      {isRecording ? "Cancel" : "Record Keys"}
                    </Button>

                    <Button
                      type="button"
                      disabled={isSavingShortcut || shortcutInput === preferences.global_shortcut}
                      onClick={handleApplyShortcut}
                      className={`h-9 px-3 text-xs rounded-xl font-medium ${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight} hover:bg-white/[0.08]`}
                    >
                      {isSavingShortcut ? "Saving…" : "Apply shortcut"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1">
                    <span>
                      {isRecording
                        ? "Recording… press a key combination (Esc cancels)."
                        : "Example: Alt+Space or Ctrl+Shift+N. Include a modifier."}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={handleRestoreDefault}
                      disabled={isSavingShortcut || preferences.global_shortcut === "Alt+Space"}
                      className="h-5 px-1.5 text-[10px] text-neutral-400 hover:text-white gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore default</span>
                    </Button>
                  </div>
                </div>

                {/* Feedback Notification Banner */}
                {shortcutFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in duration-150 ${
                      shortcutFeedback.type === "success"
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                        : shortcutFeedback.type === "error"
                        ? "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                        : "bg-sky-500/10 border border-sky-500/30 text-sky-300"
                    }`}
                  >
                    {shortcutFeedback.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : shortcutFeedback.type === "error" ? (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    ) : (
                      <Info className="w-4 h-4 shrink-0 text-sky-400" />
                    )}
                    <span className="text-[11px] leading-relaxed">
                      {shortcutFeedback.message}
                    </span>
                  </div>
                )}
              </Card>

              {/* Built-in shortcuts */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-neutral-400 block px-1">Built-in shortcuts</span>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-4">
                  <div className="min-w-0 space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Collapse island
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Return from the expanded panel to the pill.
                    </span>
                  </div>
                  <Button type="button" variant="outline" className="h-7 min-w-14 shrink-0 px-3 font-mono text-xs bg-black/30 border-white/[0.1] text-neutral-200">
                    Esc
                  </Button>
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-4">
                  <div className="min-w-0 space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Submit search
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Submit the current query from the search field.
                    </span>
                  </div>
                  <Button type="button" variant="outline" className="h-7 min-w-14 shrink-0 px-3 font-mono text-xs bg-black/30 border-white/[0.1] text-neutral-200">
                    Enter
                  </Button>
                </Card>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 4. INTELLIGENCE CATEGORIES TAB                                  */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === "categories" && (
            <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Intelligence Categories</h2>
                  <p className="text-[11px] text-neutral-400">
                    Customize which frontier streams appear inside the expanded Dynamic Island.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium px-2 py-0.5 ${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight}`}
                >
                  {activeCategoriesCount} of {totalCategoriesCount} Active
                </Badge>
              </div>

              <div className="space-y-2">
                {/* 1. World News */}
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white block">
                        World News & Diplomacy
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Global geopolitical developments, breaking headlines and multilateral summits.
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.categories.world_news}
                    onCheckedChange={() => onToggleCategory("world_news")}
                  />
                </Card>

                {/* 2. Finance & Markets */}
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white block">
                        Finance & Markets
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Macro interest rates, equities, commodities, forex indices, and bond yields.
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.categories.finance_markets}
                    onCheckedChange={() => onToggleCategory("finance_markets")}
                  />
                </Card>

                {/* 3. Technology & AI */}
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white block">
                        Technology & Artificial Intelligence
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Frontier LLMs, autonomous agents, semiconductor manufacturing, and software.
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.categories.technology_ai}
                    onCheckedChange={() => onToggleCategory("technology_ai")}
                  />
                </Card>

                {/* 4. Daily Knowledge */}
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white block">
                        Daily Knowledge & Mental Models
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Cognitive heuristics, scientific principles, philosophy, and concise synthesis.
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.categories.daily_knowledge}
                    onCheckedChange={() => onToggleCategory("daily_knowledge")}
                  />
                </Card>

                {/* 5. Business & Commerce */}
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white block">
                        Business & Venture Ecosystems
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Startups, enterprise acquisitions, venture capital rounds, and industrial supply chains.
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.categories.business}
                    onCheckedChange={() => onToggleCategory("business")}
                  />
                </Card>

                {/* 6. Science & Space */}
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                      <Microscope className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white block">
                        Science & Frontier Exploration
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Astrophysics, clean energy fusion, biomedical breakthroughs, and quantum physics.
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.categories.science}
                    onCheckedChange={() => onToggleCategory("science")}
                  />
                </Card>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 5. NOTIFICATIONS TAB                                            */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === "notifications" && (
            <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">Notification Preferences</h2>
                <p className="text-[11px] text-neutral-400">
                  Configure real-time dispatch alerts, morning briefings, and audio tones.
                </p>
              </div>

              <div className="space-y-2.5">
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Breaking News Dispatches
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      High-impact global events and emergency alerts.
                    </span>
                  </div>
                  <Switch
                    checked={preferences.notifications.breaking_news}
                    onCheckedChange={() => onToggleNotification("breaking_news")}
                  />
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Daily Morning Briefing
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Scheduled executive summary of macro conditions at market open.
                    </span>
                  </div>
                  <Switch
                    checked={preferences.notifications.daily_briefing}
                    onCheckedChange={() => onToggleNotification("daily_briefing")}
                  />
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-white block">
                      Market Movement & Volatility
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Notifies when major indexes swing greater than ±2% in intraday sessions.
                    </span>
                  </div>
                  <Switch
                    checked={preferences.notifications.market_alerts}
                    onCheckedChange={() => onToggleNotification("market_alerts")}
                  />
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                  <div className="space-y-0.5 flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-neutral-300">
                      {preferences.notifications.sound_enabled ? (
                        <Volume2 className="w-4 h-4 text-amber-400" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-neutral-500" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white block">
                        Tactile Audio Chimes
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Subtle acoustic feedback on expansion, query execution, and incoming dispatches.
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.notifications.sound_enabled}
                    onCheckedChange={() => onToggleNotification("sound_enabled")}
                  />
                </Card>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 6. ABOUT ORBIT TAB                                             */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === "about" && (
            <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">About Orbit</h2>
                <p className="text-[11px] text-neutral-400">
                  Application architecture, local persistence status, and native Win32 diagnostics.
                </p>
              </div>

              {/* System Architecture Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                    Host OS & Architecture
                  </span>
                  <span className="text-white font-medium mt-0.5 block capitalize">
                    {systemInfo?.os ?? "Windows"} ({systemInfo?.arch ?? "x86_64"})
                  </span>
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                    Tauri Native Runtime
                  </span>
                  <span className={`font-medium mt-0.5 block ${accent.text}`}>
                    {systemInfo?.tauri_version ?? "Tauri 2"} • {appStatus?.runtime_mode ?? "Active"}
                  </span>
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                        Dynamic Island Window Configuration
                      </span>
                      <span className="text-neutral-300 text-[11px] mt-0.5 block">
                        Top-Center • Borderless • Transparent • Always-on-Top • Native Win32
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Win32 Anchored
                    </Badge>
                  </div>
                  {windowGeometry && (
                    <span className="text-amber-300/80 font-mono text-[10px] mt-1 block">
                      Live Geometry: {windowGeometry.width} × {windowGeometry.height} px at ({windowGeometry.x}, {windowGeometry.y}) • Scale {windowGeometry.scale_factor}x
                    </span>
                  )}
                </Card>
              </div>

              {/* Native Host Diagnostic Ping */}
              <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-white block">
                  Native Host IPC Ping Diagnostic
                </span>
                <form onSubmit={handleTestPing} className="flex space-x-2">
                  <Input
                    type="text"
                    value={pingInput}
                    onChange={(e) => setPingInput(e.target.value)}
                    className="h-8 text-xs bg-black/60 border-white/[0.08] rounded-xl text-neutral-200"
                  />
                  <Button
                    type="submit"
                    disabled={isPinging}
                    size="sm"
                    className={`h-8 px-3 ${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight} text-xs font-medium cursor-pointer transition-colors`}
                  >
                    {isPinging ? "Testing..." : "Send Ping"}
                  </Button>
                </form>

                {pingResponse && (
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-mono">
                    ✓ {pingResponse}
                  </div>
                )}
                {pingError && (
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 font-mono">
                    ✕ {pingError}
                  </div>
                )}
              </Card>

              {/* Reset to Factory Defaults */}
              <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-white block">
                    Restore Factory Default Preferences
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    Reverts all options, shortcuts, categories, and theme accents to original state.
                  </span>
                </div>

                {confirmReset ? (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={async () => {
                        await onResetAllPreferences();
                        setConfirmReset(false);
                      }}
                      className="h-7 px-2.5 text-xs rounded-xl"
                    >
                      Confirm Reset
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setConfirmReset(false)}
                      className="h-7 px-2 text-xs rounded-xl text-neutral-400"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmReset(true)}
                    className="h-7 px-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/30 rounded-xl"
                  >
                    Reset Defaults
                  </Button>
                )}
              </Card>
            </div>
          )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}
