import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from "react";
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
  TrendingUp,
  Cpu,
  Volume2,
  Laptop,
  Moon,
  Sun,
  Rss,
  Plus,
  Trash2,
  RefreshCw,
  Bot,
  Eye,
  EyeOff,
  KeyRound,
  Mic,
  Database,
  Activity,
  Download,
  Upload,
} from "lucide-react";
import { OrbitLogo } from "../icons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  dbService,
  type DbStats,
  type NewsSource,
  type MultiAiConfigInfo,
  type NotificationPreferences,
  type StorageBreakdown,
  type ProcessMetrics,
} from "../../services/dbService";
import { voiceService } from "../../services/voiceService";
import { ttsService } from "../../services/ttsService";
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
  | "sources"
  | "ai"
  | "assistant"
  | "finance"
  | "notifications"
  | "about";

export function SettingsPage({
  onBackToIsland,
  systemInfo: _systemInfo,
  appStatus: _appStatus,
  windowGeometry: _windowGeometry,
  preferences,
  accent,
  onSetLaunchAtStartup,
  onSetStartMinimized,
  onSetCloseBehavior,
  onSetAutoCheckUpdates: _onSetAutoCheckUpdates,
  onSetTheme,
  onSetAccentColor,
  onSetEnableAnimations: _onSetEnableAnimations,
  onSetDefaultIslandMode: _onSetDefaultIslandMode,
  onToggleCategory,
  onToggleNotification: _onToggleNotification,
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

  useEffect(() => {
    setShortcutInput(preferences.global_shortcut);
  }, [preferences.global_shortcut]);

  // Reset Confirmation State
  const [confirmReset, setConfirmReset] = useState(false);

  // Database stats state
  const [dbStats, setDbStats] = useState<DbStats | null>(null);

  // News Sources Management State
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceCategory, setNewSourceCategory] = useState("technology");
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [addSourceError, setAddSourceError] = useState<string | null>(null);
  const [isSyncingSources, setIsSyncingSources] = useState(false);
  const [syncSourcesResult, setSyncSourcesResult] = useState<string | null>(null);

  // ── Multi-Provider AI State ────────────────────────────────────────────────
  const [multiAiConfig, setMultiAiConfig] = useState<MultiAiConfigInfo | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("openai");
  const [providerApiKeys, setProviderApiKeys] = useState<{ [key: string]: string }>({
    openai: "",
    groq: "",
    gemini: "",
  });
  const [providerModels, setProviderModels] = useState<{ [key: string]: string }>({
    openai: "gpt-4o-mini",
    groq: "llama-3.3-70b-versatile",
    gemini: "gemini-1.5-flash",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [explanationMode, setExplanationMode] = useState("simple");
  const [briefingLength, setBriefingLength] = useState("standard");
  const [isSavingAiConfig, setIsSavingAiConfig] = useState(false);
  const [aiConfigFeedback, setAiConfigFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [aiTestError, setAiTestError] = useState<string | null>(null);

  // ── Voice & Assistant State ───────────────────────────────────────────────
  const [voiceSupported, setVoiceSupported] = useState(voiceService.isSupported());
  const [isListeningTest, setIsListeningTest] = useState(false);
  const [voiceTestTranscript, setVoiceTestTranscript] = useState("");
  const [voiceTestError, setVoiceTestError] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>("");
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState<boolean>(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  // ── Finance State ─────────────────────────────────────────────────────────
  const [_financeConfig, setFinanceConfig] = useState<unknown | null>(null);
  const [financeApiKey, setFinanceApiKey] = useState("");
  const [showFinanceKey, setShowFinanceKey] = useState(false);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [newTickerInput, setNewTickerInput] = useState("");
  const [isSavingFinance, setIsSavingFinance] = useState(false);
  const [financeFeedback, setFinanceFeedback] = useState<string | null>(null);

  // ── Desktop Notifications State ───────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    enabled: true,
    breaking: true,
    briefings: true,
    finance: false,
    quiet_hours_enabled: false,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
  });
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  // ── Storage Breakdown & Process Telemetry State ───────────────────────────
  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdown | null>(null);
  const [processMetrics, setProcessMetrics] = useState<ProcessMetrics | null>(null);
  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [cleanCacheFeedback, setCleanCacheFeedback] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);
  const [restoreFilePath, setRestoreFilePath] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);

  // ── Data Loaders ──────────────────────────────────────────────────────────

  const loadSources = useCallback(async () => {
    setIsLoadingSources(true);
    try {
      const list = await dbService.getNewsSources();
      setSources(list);
    } catch (err) {
      console.warn("Failed to load news sources:", err);
    } finally {
      setIsLoadingSources(false);
    }
  }, []);

  const loadMultiAiConfig = useCallback(async () => {
    try {
      const cfg = await dbService.getMultiAiConfig();
      setMultiAiConfig(cfg);
      setSelectedProvider(cfg.active_provider || "openai");
      setExplanationMode(cfg.explanation_mode || "simple");
      setBriefingLength(cfg.briefing_length || "standard");

      const keys: { [key: string]: string } = {};
      const models: { [key: string]: string } = {};

      for (const p of cfg.providers) {
        keys[p.id] = p.has_key ? p.masked_key : "";
        models[p.id] = p.active_model;
      }

      setProviderApiKeys(keys);
      setProviderModels(models);
    } catch (err) {
      console.warn("Failed to load Multi-AI config:", err);
    }
  }, []);

  const loadFinanceConfig = useCallback(async () => {
    try {
      const cfg = await dbService.getFinanceConfig();
      setFinanceConfig(cfg);
      setWatchlistSymbols(cfg.watchlist || []);
      if (cfg.has_key) {
        setFinanceApiKey(cfg.masked_key);
      }
    } catch (err) {
      console.warn("Failed to load finance config:", err);
    }
  }, []);

  const loadNotificationPreferences = useCallback(async () => {
    try {
      const prefs = await dbService.getNotificationPreferences();
      setNotifPrefs(prefs);
    } catch (err) {
      console.warn("Failed to load notification preferences:", err);
    }
  }, []);

  const loadStorageAndMetrics = useCallback(async () => {
    try {
      const [storage, metrics] = await Promise.all([
        dbService.getStorageBreakdown().catch(() => null),
        dbService.getProcessMetrics().catch(() => null),
      ]);
      if (storage) setStorageBreakdown(storage);
      if (metrics) setProcessMetrics(metrics);
    } catch (err) {
      console.warn("Failed to load storage/metrics:", err);
    }
  }, []);

  const handleClearCache = async () => {
    if (isCleaningCache) return;
    setIsCleaningCache(true);
    setCleanCacheFeedback(null);
    try {
      const res = await dbService.clearTemporaryCache();
      const freedKb = (res.freed_bytes / 1024).toFixed(1);
      setCleanCacheFeedback(
        `Pruned ${res.deleted_articles} old dispatches, ${res.deleted_notifications} logs. Reclaimed ${freedKb} KB.`
      );
      await loadStorageAndMetrics();
    } catch (err) {
      setCleanCacheFeedback(err instanceof Error ? err.message : "Cache prune failed");
    } finally {
      setIsCleaningCache(false);
    }
  };

  const handleBackupDatabase = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    setBackupFeedback(null);
    try {
      const dest = await dbService.backupDatabase();
      setBackupFeedback(`Backup created: ${dest}`);
    } catch (err) {
      setBackupFeedback(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreDatabase = async () => {
    if (!restoreFilePath.trim() || isRestoring) return;
    setIsRestoring(true);
    setRestoreFeedback(null);
    try {
      await dbService.restoreDatabase(restoreFilePath.trim());
      setRestoreFeedback("Database successfully restored from backup!");
      await loadStorageAndMetrics();
    } catch (err) {
      setRestoreFeedback(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setIsRestoring(false);
    }
  };

  useEffect(() => {
    if (activeTab === "about") {
      dbService.getStats().then(setDbStats).catch(console.warn);
      loadStorageAndMetrics();
    } else if (activeTab === "sources") {
      loadSources();
    } else if (activeTab === "ai") {
      loadMultiAiConfig();
    } else if (activeTab === "finance") {
      loadFinanceConfig();
    } else if (activeTab === "notifications") {
      loadNotificationPreferences();
    } else if (activeTab === "assistant") {
      setVoiceSupported(voiceService.isSupported());
      const voices = ttsService.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoiceUri) {
        setSelectedVoiceUri(voices[0].voiceURI);
      }
    }
  }, [activeTab, loadSources, loadMultiAiConfig, loadFinanceConfig, loadNotificationPreferences, loadStorageAndMetrics, selectedVoiceUri]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveMultiAiConfig = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingAiConfig(true);
    setAiConfigFeedback(null);
    setAiTestResult(null);
    setAiTestError(null);

    try {
      const currentKey = providerApiKeys[selectedProvider] || "";
      const currentModel = providerModels[selectedProvider] || "";

      await dbService.saveMultiAiConfig({
        activeProvider: selectedProvider,
        provider: selectedProvider,
        apiKey: currentKey,
        model: currentModel,
        explanationMode,
        briefingLength,
      });

      await loadMultiAiConfig();
      setAiConfigFeedback({
        type: "success",
        message: `${selectedProvider.toUpperCase()} configuration securely updated.`,
      });
      setTimeout(() => setAiConfigFeedback(null), 4000);
    } catch (err) {
      setAiConfigFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save AI configuration.",
      });
    } finally {
      setIsSavingAiConfig(false);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setIsTestingAi(true);
    setAiTestResult(null);
    setAiTestError(null);

    try {
      const res = await dbService.testProviderConnection(providerId);
      setAiTestResult(res);
    } catch (err) {
      setAiTestError(err instanceof Error ? err.message : "Connection diagnostic failed.");
    } finally {
      setIsTestingAi(false);
    }
  };

  // Voice Test Handlers
  const handleToggleVoiceTest = async () => {
    if (isListeningTest) {
      voiceService.stopListening();
      setIsListeningTest(false);
    } else {
      setVoiceTestTranscript("");
      setVoiceTestError(null);
      const started = await voiceService.startListening(
        (text) => setVoiceTestTranscript(text),
        (err) => {
          setVoiceTestError(err);
          setIsListeningTest(false);
        },
        () => setIsListeningTest(false)
      );
      if (started) setIsListeningTest(true);
    }
  };

  const handleTestTtsSpeech = () => {
    setIsTestingVoice(true);
    ttsService.setVoice(selectedVoiceUri);
    ttsService.setRate(speechRate);
    ttsService.speak(
      "Hello! I am Orbit, your desktop intelligence assistant. Speech synthesis is functioning properly.",
      () => setIsTestingVoice(false)
    );
  };

  // Finance Handlers
  const handleSaveFinance = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingFinance(true);
    setFinanceFeedback(null);
    try {
      await dbService.saveFinanceConfig({
        apiKey: financeApiKey,
        provider: "finnhub",
      });
      await dbService.saveWatchlist(watchlistSymbols);
      setFinanceFeedback("Finance preferences and watchlist saved.");
      setTimeout(() => setFinanceFeedback(null), 3500);
      await loadFinanceConfig();
    } catch (err) {
      setFinanceFeedback("Failed to save finance settings.");
    } finally {
      setIsSavingFinance(false);
    }
  };

  const handleAddTicker = (e: FormEvent) => {
    e.preventDefault();
    const sym = newTickerInput.trim().toUpperCase();
    if (sym && !watchlistSymbols.includes(sym)) {
      const updated = [...watchlistSymbols, sym];
      setWatchlistSymbols(updated);
      setNewTickerInput("");
    }
  };

  const handleRemoveTicker = (sym: string) => {
    setWatchlistSymbols(watchlistSymbols.filter((s) => s !== sym));
  };

  // Notification Handlers
  const handleSaveNotificationPreferences = async () => {
    setIsSavingNotifs(true);
    try {
      await dbService.saveNotificationPreferences(notifPrefs);
      setNotifFeedback("Notification rules and quiet hours updated.");
      setTimeout(() => setNotifFeedback(null), 3000);
    } catch {
      setNotifFeedback("Failed to update notification settings.");
    } finally {
      setIsSavingNotifs(false);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      await dbService.sendDesktopNotification(
        "Orbit Desktop Intelligence",
        "Windows desktop alerts and notifications are verified and active.",
        "test",
        true
      );
      setNotifFeedback("Test notification dispatched to Windows Action Center.");
      setTimeout(() => setNotifFeedback(null), 4000);
    } catch (err) {
      setNotifFeedback("Notification error: please verify Windows notification settings.");
    }
  };

  // Shortcut Recording Handlers
  const handleKeyDownRecord = (e: KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Super");

    const key = e.key;
    if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
      if (key === " ") parts.push("Space");
      else if (key.length === 1) parts.push(key.toUpperCase());
      else parts.push(key);
    }

    if (parts.length > 0) {
      setShortcutInput(parts.join("+"));
    }
  };

  const handleSaveShortcut = async () => {
    setIsSavingShortcut(true);
    setShortcutFeedback(null);
    try {
      const res = await onUpdateShortcut(shortcutInput);
      setShortcutFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      if (res.success) setIsRecording(false);
    } catch (err) {
      setShortcutFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to register shortcut.",
      });
    } finally {
      setIsSavingShortcut(false);
    }
  };

  const handleRestoreDefaultShortcut = async () => {
    setIsSavingShortcut(true);
    setShortcutFeedback(null);
    try {
      const res = await onRestoreDefaultShortcut();
      setShortcutFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      if (res.success) {
        setShortcutInput("Alt+Space");
        setIsRecording(false);
      }
    } catch (err) {
      setShortcutFeedback({
        type: "error",
        message: "Failed to restore default shortcut.",
      });
    } finally {
      setIsSavingShortcut(false);
    }
  };



  const handleToggleSource = async (id: number, currentEnabled: boolean) => {
    try {
      await dbService.setNewsSourceEnabled(id, !currentEnabled);
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !currentEnabled } : s))
      );
    } catch (err) {
      console.warn("Failed to toggle source:", err);
    }
  };

  const handleDeleteSource = async (id: number) => {
    try {
      await dbService.deleteNewsSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.warn("Failed to delete source:", err);
    }
  };

  const handleAddSource = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;
    setIsAddingSource(true);
    setAddSourceError(null);
    try {
      await dbService.addNewsSource(
        newSourceName.trim(),
        newSourceUrl.trim(),
        newSourceCategory
      );
      setNewSourceName("");
      setNewSourceUrl("");
      await loadSources();
    } catch (err) {
      setAddSourceError(err instanceof Error ? err.message : "Could not add publisher feed.");
    } finally {
      setIsAddingSource(false);
    }
  };

  const handleSyncAllSources = async () => {
    if (isSyncingSources) return;
    setIsSyncingSources(true);
    setSyncSourcesResult(null);
    try {
      const report = await dbService.syncNewsFeeds();
      setSyncSourcesResult(
        `Synchronized ${report.fetched_sources} feeds • ${report.new_articles} new dispatches`
      );
      await loadSources();
    } catch (err) {
      setSyncSourcesResult("Feed sync failed. Check network connectivity.");
    } finally {
      setIsSyncingSources(false);
    }
  };

  // ── Navigation Items ───────────────────────────────────────────────────────
  const navItems: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: "general", label: "General", icon: <Sliders className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "shortcuts", label: "Shortcuts", icon: <Keyboard className="w-4 h-4" /> },
    { id: "categories", label: "Intelligence", icon: <Cpu className="w-4 h-4" /> },
    { id: "sources", label: "News Feeds", icon: <Rss className="w-4 h-4" /> },
    { id: "ai", label: "Multi-Provider AI", icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
    { id: "assistant", label: "Voice & Speech", icon: <Bot className="w-4 h-4 text-sky-400" /> },
    { id: "finance", label: "Finance & Stocks", icon: <TrendingUp className="w-4 h-4 text-emerald-400" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "about", label: "About & Storage", icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <Card
      onClick={(e) => e.stopPropagation()}
      className="w-[780px] h-[560px] p-0 gap-0 bg-card border-white/[0.09] hover:border-white/[0.13] rounded-3xl overflow-hidden text-neutral-200 select-none ring-1 ring-white/[0.04] flex flex-col"
    >
      {/* ── Top Drag & Navigation Bar ──────────────────────────────────── */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-5 py-3 cursor-move bg-gradient-to-b from-white/[0.02] to-transparent border-b border-white/[0.06] shrink-0"
      >
        <div className="flex items-center space-x-2" data-tauri-drag-region="false">
          <Button
            variant="ghost"
            size="xs"
            onClick={onBackToIsland}
            className={`h-7 px-2.5 text-xs text-neutral-300 hover:text-white ${accent.bgSubtle} hover:${accent.borderSubtle} border border-transparent rounded-xl gap-1.5`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Island</span>
          </Button>

          <Separator orientation="vertical" className="h-4 bg-white/[0.1]" />

          <div className="flex items-center space-x-2 pointer-events-none">
            <div className={`w-5 h-5 rounded-full ${accent.bgSubtle} border ${accent.borderSubtle} flex items-center justify-center ${accent.text}`}>
              <OrbitLogo className="w-3 h-3" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-white">
              Orbit System Preferences
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1" data-tauri-drag-region="false">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onBackToIsland}
            className="text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Main Layout: Sidebar Navigation + Content Area ─────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-48 bg-black/40 border-r border-white/[0.06] p-3 flex flex-col justify-between shrink-0">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 px-3 block">
              Preferences
            </span>
            <div className="space-y-0.5 pt-1">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    onClick={() => setActiveTab(item.id)}
                    data-monochrome-active={active ? "true" : undefined}
                    className={`w-full flex items-center justify-start gap-2.5 h-7 px-2.5 text-xs rounded-xl transition-all cursor-pointer ${active
                        ? "border border-current bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                        : "text-neutral-400 hover:text-white hover:bg-white/[0.08] hover:ring-1 hover:ring-white/[0.12]"
                      }`}
                  >
                    <span
                      data-sidebar-icon="true"
                      data-accentable={active && accent.id !== "neutral" ? "true" : undefined}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center ${active ? accent.id === "neutral" ? "text-white dark:text-black" : accent.textLight : "text-neutral-400"}`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate text-left">{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[9px] text-neutral-500 space-y-0.5">
            <div className="font-medium text-neutral-400 flex items-center justify-between">
              <span>Orbit Intelligence</span>
              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
            </div>
            <div>Groq • OpenAI • Gemini</div>
          </div>
        </div>

        {/* Content Pane */}
        <ScrollArea className="flex-1 min-w-0 bg-background">
          <div className="min-h-full p-5">

            {/* ════════════════════════════════════════════════════════════ */}
            {/* 1. GENERAL TAB                                              */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activeTab === "general" && (
              <div className="w-full space-y-4 animate-in fade-in duration-150">
                <div>
                  <h2 className="text-sm font-semibold text-white">General Preferences</h2>
                  <p className="text-[11px] text-neutral-400">
                    Control startup behavior, taskbar integration, and window lifecycle.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="text-xs font-medium text-white block">
                        Launch on Windows Startup
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Automatically position the Dynamic Island top-center when logging in.
                      </span>
                    </div>
                    <Switch
                      checked={preferences.launch_at_startup}
                      onCheckedChange={(checked) => onSetLaunchAtStartup(checked)}
                    />
                  </Card>

                  <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="text-xs font-medium text-white block">
                        Start Minimized to System Tray
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Begin in the background without displaying until requested.
                      </span>
                    </div>
                    <Switch
                      checked={preferences.start_minimized}
                      onCheckedChange={(checked) => onSetStartMinimized(checked)}
                    />
                  </Card>

                  <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2.5">
                    <div>
                      <span className="text-xs font-medium text-white block">Close Button Behavior</span>
                      <span className="text-[10px] text-neutral-400 block">
                        Determine what occurs when clicking the window close button.
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["tray", "minimize", "exit"] as CloseBehavior[]).map((mode) => (
                        <Button
                          key={mode}
                          type="button"
                          variant={preferences.close_behavior === mode ? "secondary" : "outline"}
                          onClick={() => onSetCloseBehavior(mode)}
                          className={`h-8 justify-center px-3 text-xs rounded-xl capitalize ${preferences.close_behavior === mode
                              ? `${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight} font-semibold`
                              : "bg-black/30 border-white/[0.06] text-neutral-400"
                            }`}
                        >
                          {mode === "tray" ? "Hide to Tray" : mode === "minimize" ? "Minimize" : "Exit App"}
                        </Button>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* 2. APPEARANCE TAB                                           */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activeTab === "appearance" && (
              <div className="w-full space-y-4 animate-in fade-in duration-150">
                <div>
                  <h2 className="text-sm font-semibold text-white">Appearance & Theme</h2>
                  <p className="text-[11px] text-neutral-400">
                    Personalize aesthetics, theme mode, and accent colors.
                  </p>
                </div>

                <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2.5">
                  <span className="text-xs font-medium text-white block">Theme Mode</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "dark", label: "Dark", icon: <Moon className="w-3.5 h-3.5" /> },
                      { id: "light", label: "Light", icon: <Sun className="w-3.5 h-3.5" /> },
                      { id: "system", label: "System", icon: <Laptop className="w-3.5 h-3.5" /> },
                    ].map((th) => (
                      <Button
                        key={th.id}
                        type="button"
                        data-monochrome-active={preferences.theme === th.id ? "true" : undefined}
                        variant={preferences.theme === th.id ? "secondary" : "outline"}
                        onClick={() => onSetTheme(th.id as ThemeMode)}
                        className={`h-8 justify-center px-3 text-xs gap-2 rounded-xl ${preferences.theme === th.id
                            ? "font-semibold"
                            : "bg-black/30 border-white/[0.06] text-neutral-400"
                          }`}
                      >
                        {th.icon}
                        <span>{th.label}</span>
                      </Button>
                    ))}
                  </div>
                </Card>

                <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2.5">
                  <span className="text-xs font-medium text-white block">Accent Palette</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(ACCENT_THEMES) as AccentColor[]).map((colKey) => {
                      const themeObj = ACCENT_THEMES[colKey];
                      const isSelected = preferences.accent_color === colKey;
                      return (
                        <Button
                          key={colKey}
                          type="button"
                          data-accentable={isSelected && colKey !== "neutral" ? "true" : undefined}
                          variant={isSelected ? "secondary" : "outline"}
                          onClick={() => onSetAccentColor(colKey)}
                          className={`h-9 justify-start px-3 text-xs gap-2.5 rounded-xl cursor-pointer ${isSelected
                              ? `${themeObj.bgSubtle} border ${themeObj.borderActive} ${themeObj.textLight} font-semibold`
                              : "bg-black/30 border-white/[0.06] text-neutral-400 hover:text-white"
                            }`}
                        >
                          <span className={`w-3 h-3 rounded-full ${themeObj.dot}`} />
                          <span className="flex-1 text-left">{themeObj.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </Button>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* 3. KEYBOARD SHORTCUTS TAB                                   */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activeTab === "shortcuts" && (
              <div className="w-full space-y-4 animate-in fade-in duration-150">
                <div>
                  <h2 className="text-sm font-semibold text-white">Global Shortcuts</h2>
                  <p className="text-[11px] text-neutral-400">
                    Access the Dynamic Island from any active Windows application.
                  </p>
                </div>

                <Card className="p-4 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white block">Toggle Island Shortcut</span>
                      <span className="text-[10px] text-neutral-400 block">Default: Alt+Space</span>
                    </div>
                    <kbd className={`px-2.5 py-1 text-xs font-mono rounded-lg border bg-black/60 ${accent.borderSubtle} ${accent.textLight}`}>
                      {shortcutInput}
                    </kbd>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        ref={recordInputRef}
                        type="text"
                        readOnly
                        value={isRecording ? "Press key combination..." : shortcutInput}
                        onKeyDown={handleKeyDownRecord}
                        onFocus={() => setIsRecording(true)}
                        onBlur={() => setIsRecording(false)}
                        className={`h-9 text-xs font-mono bg-black/40 border-white/[0.08] text-center text-white cursor-pointer rounded-xl ${isRecording ? `ring-2 ${accent.borderActive}` : ""
                          }`}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={handleRestoreDefaultShortcut}
                        disabled={isSavingShortcut}
                        className="text-neutral-400 hover:text-white text-xs gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore Alt+Space</span>
                      </Button>

                      <Button
                        type="button"
                        size="xs"
                        onClick={handleSaveShortcut}
                        disabled={isSavingShortcut}
                        className="h-7 px-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold rounded-xl text-xs"
                      >
                        <span>{isSavingShortcut ? "Saving..." : "Apply Shortcut"}</span>
                      </Button>
                    </div>

                    {shortcutFeedback && (
                      <p className={`text-[10px] ${shortcutFeedback.type === "success" ? "text-emerald-400" : "text-rose-400"}`}>
                        {shortcutFeedback.message}
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* 4. INTELLIGENCE CATEGORIES TAB                              */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activeTab === "categories" && (
              <div className="w-full space-y-4 animate-in fade-in duration-150">
                <div>
                  <h2 className="text-sm font-semibold text-white">Intelligence Streams</h2>
                  <p className="text-[11px] text-neutral-400">
                    Enable or disable specific topic pipelines for AI synthesis.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { key: "world_news", label: "World Affairs", desc: "Geopolitical events & governance" },
                    { key: "finance_markets", label: "Finance & Markets", desc: "Equities, macro trends & currencies" },
                    { key: "technology_ai", label: "Technology & AI", desc: "LLMs, semiconductors & computing" },
                    { key: "daily_knowledge", label: "Macro Analysis", desc: "Policy briefs & structural shifts" },
                    { key: "business", label: "Business & Commerce", desc: "Enterprises, earnings & supply chains" },
                    { key: "science", label: "Science & Discovery", desc: "Space, energy, medicine & breakthroughs" },
                  ].map((c) => {
                    const isEnabled = preferences.categories[c.key as keyof CategoriesPreferences];
                    return (
                      <Card key={c.key} className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                        <div className="truncate">
                          <span className="text-xs font-semibold text-white block">{c.label}</span>
                          <span className="text-[10px] text-neutral-400 block truncate">{c.desc}</span>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => onToggleCategory(c.key as keyof CategoriesPreferences)}
                        />
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* 5. NEWS SOURCES & RSS TAB                                   */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activeTab === "sources" && (
              <div className="w-full space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Publisher RSS Feeds</h2>
                    <p className="text-[11px] text-neutral-400">
                      Verified publisher feeds synchronized locally into SQLite.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="xs"
                    disabled={isSyncingSources}
                    onClick={handleSyncAllSources}
                    className={`h-7 px-2.5 text-xs ${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight} gap-1.5 rounded-xl`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingSources ? "animate-spin" : ""}`} />
                    <span>{isSyncingSources ? "Syncing..." : "Sync All Feeds"}</span>
                  </Button>
                </div>

                {syncSourcesResult && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    {syncSourcesResult}
                  </div>
                )}

                {/* Add Custom Feed */}
                <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2">
                  <span className="text-xs font-semibold text-white block">Add Custom RSS / Atom Feed</span>
                  <form onSubmit={handleAddSource} className="grid grid-cols-3 gap-2">
                    <Input
                      type="text"
                      placeholder="Publisher name"
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      className="h-8 text-xs bg-black/50 border-white/[0.08] rounded-xl text-neutral-200"
                    />
                    <Input
                      type="url"
                      placeholder="RSS feed URL"
                      value={newSourceUrl}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                      className="h-8 text-xs bg-black/50 border-white/[0.08] rounded-xl text-neutral-200"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newSourceCategory}
                        onChange={(e) => setNewSourceCategory(e.target.value)}
                        className="h-8 text-xs bg-black/60 border border-white/[0.08] rounded-xl px-2 text-neutral-200 flex-1"
                      >
                        <option value="world">World</option>
                        <option value="technology">Technology</option>
                        <option value="ai">AI</option>
                        <option value="finance">Finance</option>
                        <option value="business">Business</option>
                        <option value="science">Science</option>
                      </select>
                      <Button
                        type="submit"
                        disabled={isAddingSource || !newSourceName.trim() || !newSourceUrl.trim()}
                        size="xs"
                        className="h-8 px-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold rounded-xl text-xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </form>
                  {addSourceError && <p className="text-[10px] text-rose-400">{addSourceError}</p>}
                </Card>

                {/* Feed List */}
                <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {isLoadingSources ? (
                    <div className="h-20 flex items-center justify-center text-xs text-neutral-500">
                      Loading feeds...
                    </div>
                  ) : (
                    sources.map((src) => (
                      <Card
                        key={src.id}
                        className="p-2.5 bg-white/[0.02] border-white/[0.06] rounded-xl flex flex-row items-center justify-between gap-2"
                      >
                        <div className="truncate flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-white">{src.name}</span>
                            <Badge variant="outline" className="text-[8px] uppercase px-1 py-0 bg-white/[0.04]">
                              {src.category}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-neutral-500 font-mono truncate block">
                            {src.url}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <Switch
                            checked={src.enabled}
                            onCheckedChange={() => handleToggleSource(src.id, src.enabled)}
                          />
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDeleteSource(src.id)}
                            className="text-neutral-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* 6. MULTI-PROVIDER AI CONFIGURATION TAB                     */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activeTab === "ai" && (
              <div className="w-full space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Multi-Provider AI Architecture</h2>
                    <p className="text-[11px] text-neutral-400">
                      Select your preferred provider (Groq, OpenAI, Gemini) and model.
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 ${multiAiConfig?.providers.find((p) => p.id === selectedProvider)?.has_key
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      }`}
                  >
                    <Bot className="w-3 h-3 mr-1" />
                    {multiAiConfig?.providers.find((p) => p.id === selectedProvider)?.has_key
                      ? `${selectedProvider.toUpperCase()} Ready`
                      : "Heuristic Fallback"}
                  </Badge>
                </div>

                {/* Provider Selector Cards */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: "groq",
                      name: "Groq",
                      subtitle: "Llama 3.3 70B • Ultra-fast",
                      badge: "High Speed",
                      badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/30",
                    },
                    {
                      id: "openai",
                      name: "OpenAI",
                      subtitle: "GPT-4o Mini / GPT-4o",
                      badge: "Standard",
                      badgeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                    },
                    {
                      id: "gemini",
                      name: "Google Gemini",
                      subtitle: "Gemini 1.5 Flash / 2.0",
                      badge: "Multimodal",
                      badgeCls: "bg-sky-500/20 text-sky-300 border-sky-500/30",
                    },
                  ].map((prov) => {
                    const isSelected = selectedProvider === prov.id;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => setSelectedProvider(prov.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${isSelected
                            ? "bg-amber-400/10 border-amber-400/50 text-white shadow-sm"
                            : "bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{prov.name}</span>
                          <Badge variant="outline" className={`text-[8px] ${prov.badgeCls}`}>
                            {prov.badge}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-neutral-400 block mt-1">{prov.subtitle}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Provider Settings Card */}
                <Card className="p-4 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-white">
                        {selectedProvider.toUpperCase()} Credentials & Model
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500">Stored securely on Rust backend</span>
                  </div>

                  <form onSubmit={handleSaveMultiAiConfig} className="space-y-3">
                    {/* API Key Input */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-300 block">
                        {selectedProvider.toUpperCase()} API Key
                      </label>
                      <div className="relative flex items-center">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={providerApiKeys[selectedProvider] || ""}
                          onChange={(e) =>
                            setProviderApiKeys({
                              ...providerApiKeys,
                              [selectedProvider]: e.target.value,
                            })
                          }
                          placeholder={
                            selectedProvider === "groq"
                              ? "gsk_..."
                              : selectedProvider === "gemini"
                                ? "AIzaSy..."
                                : "sk-proj-..."
                          }
                          className="h-8 text-xs font-mono bg-black/40 border-white/[0.08] focus-visible:ring-1 focus-visible:ring-amber-400/40 pr-10 text-white rounded-xl"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-1 text-neutral-400 hover:text-white"
                        >
                          {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                      <span className="text-[9px] text-neutral-500 block">
                        Never exposed to browser bundles or logs. Inherited from environment variable fallback if not set.
                      </span>
                    </div>

                    {/* Model Dropdown */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-300 block">
                        Select Model for {selectedProvider.toUpperCase()}
                      </label>
                      <select
                        value={providerModels[selectedProvider] || ""}
                        onChange={(e) =>
                          setProviderModels({
                            ...providerModels,
                            [selectedProvider]: e.target.value,
                          })
                        }
                        className="w-full h-8 text-xs bg-black/60 border border-white/[0.08] rounded-xl px-2.5 text-neutral-200 focus:outline-none"
                      >
                        {multiAiConfig?.providers
                          .find((p) => p.id === selectedProvider)
                          ?.available_models.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          )) || (
                            <option value={providerModels[selectedProvider]}>
                              {providerModels[selectedProvider]}
                            </option>
                          )}
                      </select>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handleTestProvider(selectedProvider)}
                        disabled={isTestingAi}
                        className="h-7 text-xs px-2.5 rounded-xl border-white/[0.08] hover:bg-white/[0.06] text-neutral-300 gap-1.5"
                      >
                        <RefreshCw className={`w-3 h-3 ${isTestingAi ? "animate-spin text-amber-400" : ""}`} />
                        <span>{isTestingAi ? "Testing..." : `Test ${selectedProvider.toUpperCase()}`}</span>
                      </Button>

                      <Button
                        type="submit"
                        disabled={isSavingAiConfig}
                        className="h-7 text-xs px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSavingAiConfig ? "Saving..." : "Save AI Provider"}</span>
                      </Button>
                    </div>

                    {aiConfigFeedback && (
                      <p className={`text-[10px] ${aiConfigFeedback.type === "success" ? "text-emerald-400" : "text-rose-400"}`}>
                        {aiConfigFeedback.message}
                      </p>
                    )}

                    {aiTestResult && (
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300">
                        {aiTestResult}
                      </div>
                    )}

                    {aiTestError && (
                      <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300">
                        {aiTestError}
                      </div>
                    )}
                  </form>
                </Card>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* 7. VOICE & ASSISTANT SETTINGS TAB                           */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activeTab === "assistant" && (
              <div className="w-full space-y-4 animate-in fade-in duration-150">
                <div>
                  <h2 className="text-sm font-semibold text-white">Voice & Speech Interaction</h2>
                  <p className="text-[11px] text-neutral-400">
                    Microphone voice dictation and native text-to-speech audio readout.
                  </p>
                </div>

                {/* Voice Input Section */}
                <Card className="p-4 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Mic className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-semibold text-white">Speech-to-Text Input</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${voiceSupported
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        }`}
                    >
                      {voiceSupported ? "Groq Whisper AI Dictation Ready" : "Manual Text Fallback"}
                    </Badge>
                  </div>

                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    Voice dictation records audio using your system microphone and transcribes it in milliseconds using Groq / OpenAI Whisper AI. Click the test microphone button below to test your audio device.
                  </p>

                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleToggleVoiceTest}
                      className={`h-7 px-3 text-xs rounded-xl border-white/[0.08] gap-1.5 ${isListeningTest ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse" : ""
                        }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isListeningTest ? "Listening... (Click to Stop)" : "Test Microphone"}</span>
                    </Button>
                  </div>

                  {voiceTestTranscript && (
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-neutral-200">
                      <span className="text-[9px] text-neutral-500 block uppercase">Recognized Speech:</span>
                      &ldquo;{voiceTestTranscript}&rdquo;
                    </div>
                  )}

                  {voiceTestError && (
                    <p className="text-[10px] text-rose-400">{voiceTestError}</p>
                  )}
                </Card>

                {/* Text to Speech Output Section */}
                <Card className="p-4 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Volume2 className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-white">Voice Output (Text-to-Speech)</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] bg-white/[0.04]">
                      System Synthesizer
                    </Badge>
                  </div>

                  {/* System Voice Selection */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-300 block">Available System Voices</label>
                    <select
                      value={selectedVoiceUri}
                      onChange={(e) => {
                        setSelectedVoiceUri(e.target.value);
                        ttsService.setVoice(e.target.value);
                      }}
                      className="w-full h-8 text-xs bg-black/60 border border-white/[0.08] rounded-xl px-2.5 text-neutral-200 focus:outline-none"
                    >
                      {availableVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                      {availableVoices.length === 0 && <option value="">Default Windows System Voice</option>}
                    </select>
                  </div>

                  {/* Speech Rate Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-neutral-300">
                      <span>Speaking Speed</span>
                      <span className="font-mono text-neutral-400">{speechRate}x</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {[0.8, 1.0, 1.2, 1.5].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => {
                            setSpeechRate(rate);
                            ttsService.setRate(rate);
                          }}
                          className={`px-2.5 py-1 text-[10px] rounded-lg border font-mono cursor-pointer transition-all ${speechRate === rate
                              ? "bg-amber-400/20 text-amber-200 border-amber-400/30 font-semibold"
                              : "bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white"
                            }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto-speak Toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-white block">Auto-read AI Responses</span>
                      <span className="text-[10px] text-neutral-400 block">
                        Automatically speak conversational answers aloud when received.
                      </span>
                    </div>
                    <Switch
                      checked={autoSpeakEnabled}
                      onCheckedChange={(checked) => {
                        setAutoSpeakEnabled(checked);
                        ttsService.setAutoSpeak(checked);
                      }}
                    />
                  </div>

                  {/* Test Speech Button */}
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={isTestingVoice}
                      onClick={handleTestTtsSpeech}
                      className="h-7 text-xs px-3 rounded-xl border-white/[0.08] hover:bg-white/[0.06] text-neutral-300 gap-1.5"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{isTestingVoice ? "Speaking..." : "Test Voice Synthesis"}</span>
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* 8. FINANCE & MARKETS TAB                                    */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activeTab === "finance" && (
              <div className="w-full space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Finance & Markets Intelligence</h2>
                    <p className="text-[11px] text-neutral-400">
                      Configure Finnhub API credentials and manage your asset watchlist.
                    </p>
                  </div>

                  <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                    Finnhub Integration
                  </Badge>
                </div>

                <Card className="p-4 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-3.5">
                  <form onSubmit={handleSaveFinance} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-300 block">
                        Finnhub API Key (Optional)
                      </label>
                      <div className="relative flex items-center">
                        <Input
                          type={showFinanceKey ? "text" : "password"}
                          value={financeApiKey}
                          onChange={(e) => setFinanceApiKey(e.target.value)}
                          placeholder="e.g. c123456789..."
                          className="h-8 text-xs font-mono bg-black/40 border-white/[0.08] focus-visible:ring-1 focus-visible:ring-emerald-400/40 pr-10 text-white rounded-xl"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setShowFinanceKey(!showFinanceKey)}
                          className="absolute right-1 text-neutral-400 hover:text-white"
                        >
                          {showFinanceKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                      <span className="text-[9px] text-neutral-500 block">
                        Free API key available at finnhub.io. If not configured, high-fidelity delayed sample data is provided.
                      </span>
                    </div>

                    {/* Watchlist Symbols Manager */}
                    <div className="space-y-2 pt-1">
                      <label className="text-[11px] font-medium text-neutral-300 block">
                        Watchlist Symbols ({watchlistSymbols.length})
                      </label>
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-black/40 border border-white/[0.06] min-h-[44px]">
                        {watchlistSymbols.map((sym) => (
                          <span
                            key={sym}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs font-mono text-emerald-300"
                          >
                            <span>{sym}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTicker(sym)}
                              className="text-neutral-500 hover:text-rose-400 cursor-pointer ml-1"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="Add symbol (e.g. AAPL, NVDA, BTC-USD)"
                          value={newTickerInput}
                          onChange={(e) => setNewTickerInput(e.target.value)}
                          className="h-8 text-xs font-mono bg-black/50 border-white/[0.08] rounded-xl text-neutral-200"
                        />
                        <Button
                          type="button"
                          size="xs"
                          onClick={handleAddTicker}
                          disabled={!newTickerInput.trim()}
                          className="h-8 px-3 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-xl text-xs"
                        >
                          Add Ticker
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[9px] text-neutral-500">
                        Information only • Not financial or investment advice
                      </span>

                      <Button
                        type="submit"
                        disabled={isSavingFinance}
                        className="h-7 text-xs px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSavingFinance ? "Saving..." : "Save Finance Settings"}</span>
                      </Button>
                    </div>

                    {financeFeedback && (
                      <p className="text-[10px] text-emerald-400">{financeFeedback}</p>
                    )}
                  </form>
                </Card>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* 9. NOTIFICATIONS TAB                                        */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activeTab === "notifications" && (
              <div className="w-full space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Desktop Notifications & Quiet Hours</h2>
                    <p className="text-[11px] text-neutral-400">
                      Configure Windows Action Center toast notifications, triggers, and quiet schedule.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleSendTestNotification}
                    className="h-7 text-xs rounded-xl border-white/[0.08] hover:bg-white/[0.06] text-neutral-300"
                  >
                    Send Test Alert
                  </Button>
                </div>

                <div className="space-y-2.5">
                  <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-white block">Master Desktop Notifications</span>
                      <span className="text-[10px] text-neutral-400 block">
                        Allow Orbit to display Windows desktop notifications.
                      </span>
                    </div>
                    <Switch
                      checked={notifPrefs.enabled}
                      onCheckedChange={(checked) => setNotifPrefs({ ...notifPrefs, enabled: checked })}
                    />
                  </Card>

                  <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-white block">Breaking News Alerts</span>
                      <span className="text-[10px] text-neutral-400 block">
                        Immediate alerts on corroborated high-impact world events.
                      </span>
                    </div>
                    <Switch
                      checked={notifPrefs.breaking}
                      onCheckedChange={(checked) => setNotifPrefs({ ...notifPrefs, breaking: checked })}
                    />
                  </Card>

                  <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-white block">Daily Briefings Completed</span>
                      <span className="text-[10px] text-neutral-400 block">
                        Notifies when morning or evening intelligence synthesis completes.
                      </span>
                    </div>
                    <Switch
                      checked={notifPrefs.briefings}
                      onCheckedChange={(checked) => setNotifPrefs({ ...notifPrefs, briefings: checked })}
                    />
                  </Card>

                  <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex flex-row items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-white block">Finance Watchlist Alerts</span>
                      <span className="text-[10px] text-neutral-400 block">
                        Notifies on major swings (&gt;3%) in your selected watchlist symbols.
                      </span>
                    </div>
                    <Switch
                      checked={notifPrefs.finance}
                      onCheckedChange={(checked) => setNotifPrefs({ ...notifPrefs, finance: checked })}
                    />
                  </Card>

                  {/* Quiet Hours Card */}
                  <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-white block">Quiet Hours Schedule</span>
                        <span className="text-[10px] text-neutral-400 block">
                          Suppress all sound and toast alerts during scheduled downtime.
                        </span>
                      </div>
                      <Switch
                        checked={notifPrefs.quiet_hours_enabled}
                        onCheckedChange={(checked) =>
                          setNotifPrefs({ ...notifPrefs, quiet_hours_enabled: checked })
                        }
                      />
                    </div>

                    {notifPrefs.quiet_hours_enabled && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-400 block">Quiet Hours Start</label>
                          <Input
                            type="time"
                            value={notifPrefs.quiet_hours_start}
                            onChange={(e) => setNotifPrefs({ ...notifPrefs, quiet_hours_start: e.target.value })}
                            className="h-8 text-xs bg-black/50 border-white/[0.08] rounded-xl text-neutral-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-400 block">Quiet Hours End</label>
                          <Input
                            type="time"
                            value={notifPrefs.quiet_hours_end}
                            onChange={(e) => setNotifPrefs({ ...notifPrefs, quiet_hours_end: e.target.value })}
                            className="h-8 text-xs bg-black/50 border-white/[0.08] rounded-xl text-neutral-200"
                          />
                        </div>
                      </div>
                    )}
                  </Card>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      size="xs"
                      disabled={isSavingNotifs}
                      onClick={handleSaveNotificationPreferences}
                      className="h-7 text-xs px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSavingNotifs ? "Saving..." : "Save Notification Rules"}</span>
                    </Button>
                  </div>

                  {notifFeedback && (
                    <p className="text-[10px] text-emerald-400 text-right">{notifFeedback}</p>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* 10. ABOUT & STORAGE TAB                                     */}
            {/* ════════════════════════════════════════════════════════════ */}
            {activeTab === "about" && (
              <div className="w-full space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-2xl ${accent.bgSubtle} border ${accent.borderSubtle} flex items-center justify-center ${accent.text} shadow-sm`}>
                      <OrbitLogo className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">Orbit Desktop Intelligence</h2>
                      <p className="text-[11px] text-neutral-400">
                        Tauri 2 • Rust • SQLite • Multi-Provider AI • Local-First
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="xs"
                    onClick={loadStorageAndMetrics}
                    className="h-7 text-xs rounded-xl border-white/[0.08] hover:bg-white/[0.06] text-neutral-300 gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Telemetry</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-1">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">App Version</span>
                    <span className="text-xs font-semibold text-white block">v0.1.0 Release Candidate</span>
                  </Card>
                  <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-1">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Target Architecture</span>
                    <span className="text-xs font-semibold text-white block">Windows 64-bit • Native Rust • WebView2</span>
                  </Card>
                </div>

                {/* ── Process Telemetry (RAM & CPU) ─────────────────────────── */}
                <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-white">Live Process Telemetry</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
                      Zero Continuous Polling
                    </Badge>
                  </div>

                  {processMetrics ? (
                    <div className="grid grid-cols-4 gap-2 text-[10px]">
                      <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                        <span className="text-neutral-500 block">RAM Working Set</span>
                        <span className="text-sm font-semibold text-white">{processMetrics.ram_working_set_mb} MB</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                        <span className="text-neutral-500 block">Peak RAM</span>
                        <span className="text-sm font-semibold text-white">{processMetrics.ram_peak_working_set_mb} MB</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                        <span className="text-neutral-500 block">Process CPU Time</span>
                        <span className="text-sm font-semibold text-white">{processMetrics.cpu_time_seconds} s</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                        <span className="text-neutral-500 block">Session Uptime</span>
                        <span className="text-sm font-semibold text-white">
                          {Math.floor(processMetrics.uptime_seconds / 60)}m {processMetrics.uptime_seconds % 60}s
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-neutral-400 py-2">Measuring process working set...</div>
                  )}
                </Card>

                {/* ── SQLite Storage Breakdown ─────────────────────────────── */}
                <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Database className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-white">SQLite Storage Architecture</span>
                    </div>
                    {storageBreakdown && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 border-amber-500/20 text-amber-300">
                        {storageBreakdown.file_size_mb} MB Disk Footprint
                      </Badge>
                    )}
                  </div>

                  {storageBreakdown ? (
                    <div className="space-y-2">
                      <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04] text-[10px]">
                        <span className="text-neutral-500 block">Database Location:</span>
                        <span className="text-neutral-300 font-mono text-[9px] break-all">{storageBreakdown.db_path}</span>
                      </div>

                      <div className="grid grid-cols-5 gap-2 text-[10px]">
                        <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                          <span className="text-neutral-500 block">Dispatches</span>
                          <span className="text-sm font-semibold text-white">{storageBreakdown.article_count}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                          <span className="text-neutral-500 block">Briefings</span>
                          <span className="text-sm font-semibold text-white">{storageBreakdown.briefing_count}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                          <span className="text-neutral-500 block">Chats</span>
                          <span className="text-sm font-semibold text-white">{storageBreakdown.conversation_count}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                          <span className="text-neutral-500 block">Messages</span>
                          <span className="text-sm font-semibold text-white">{storageBreakdown.message_count}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                          <span className="text-neutral-500 block">Alert Logs</span>
                          <span className="text-sm font-semibold text-white">{storageBreakdown.notification_count}</span>
                        </div>
                      </div>
                    </div>
                  ) : dbStats ? (
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                        <span className="text-neutral-500 block">Dispatches</span>
                        <span className="text-sm font-semibold text-white">{dbStats.articles}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                        <span className="text-neutral-500 block">Briefings</span>
                        <span className="text-sm font-semibold text-white">{dbStats.briefings}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                        <span className="text-neutral-500 block">Feed Sources</span>
                        <span className="text-sm font-semibold text-white">{dbStats.news_sources}</span>
                      </div>
                    </div>
                  ) : null}
                </Card>

                {/* ── Cache Maintenance & Pruning ──────────────────────────── */}
                <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white block">Safe Cache Cleanup</span>
                      <span className="text-[10px] text-neutral-400 block">
                        Prunes cached articles older than 14 days and notification logs older than 7 days, then runs VACUUM. Briefings, assistant chats, and preferences are permanently kept.
                      </span>
                    </div>

                    <Button
                      type="button"
                      size="xs"
                      disabled={isCleaningCache}
                      onClick={handleClearCache}
                      className="h-7 text-xs px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-neutral-200 border border-white/[0.08] cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1 text-amber-400" />
                      <span>{isCleaningCache ? "Pruning..." : "Prune Cache & Vacuum"}</span>
                    </Button>
                  </div>

                  {cleanCacheFeedback && (
                    <p className="text-[10px] text-emerald-400">{cleanCacheFeedback}</p>
                  )}
                </Card>

                {/* ── Online Database Backup & Restore ─────────────────────── */}
                <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white block">Online Database Backup & Restore</span>
                      <span className="text-[10px] text-neutral-400 block">
                        Safely snapshot the live SQLite database without locks or disruption.
                      </span>
                    </div>

                    <Button
                      type="button"
                      size="xs"
                      disabled={isBackingUp}
                      onClick={handleBackupDatabase}
                      className="h-7 text-xs px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold gap-1.5 cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isBackingUp ? "Backing up..." : "Backup Database"}</span>
                    </Button>
                  </div>

                  {backupFeedback && (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-mono break-all">
                      {backupFeedback}
                    </div>
                  )}

                  <div className="pt-1 border-t border-white/[0.04] space-y-1.5">
                    <span className="text-[10px] text-neutral-400 block">Restore from Backup Archive:</span>
                    <div className="flex items-center gap-2">
                      <Input
                        value={restoreFilePath}
                        onChange={(e) => setRestoreFilePath(e.target.value)}
                        placeholder="D:\extra file\database\nexora_backup_....db"
                        className="h-8 text-xs bg-black/50 border-white/[0.08] rounded-xl text-neutral-200 font-mono flex-1"
                      />
                      <Button
                        type="button"
                        size="xs"
                        disabled={!restoreFilePath.trim() || isRestoring}
                        onClick={handleRestoreDatabase}
                        className="h-8 text-xs px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-neutral-200 border border-white/[0.08] cursor-pointer shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" />
                        <span>{isRestoring ? "Restoring..." : "Restore"}</span>
                      </Button>
                    </div>

                    {restoreFeedback && (
                      <p className={`text-[10px] ${restoreFeedback.includes("fail") ? "text-rose-400" : "text-emerald-400"}`}>
                        {restoreFeedback}
                      </p>
                    )}
                  </div>
                </Card>

                {/* Reset all settings */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-[10px] text-neutral-500">
                    Orbit Desktop • Built with Tauri 2 + Rust + React
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      if (confirmReset) {
                        onResetAllPreferences();
                        setConfirmReset(false);
                      } else {
                        setConfirmReset(true);
                      }
                    }}
                    className={`h-7 px-3 text-xs rounded-xl ${confirmReset
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "text-neutral-500 hover:text-rose-400"
                      }`}
                  >
                    <span>{confirmReset ? "Click again to confirm reset" : "Restore All Default Preferences"}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}
