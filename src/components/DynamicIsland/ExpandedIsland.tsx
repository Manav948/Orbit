import { useState, useRef, useEffect, useCallback, type FormEvent, type ChangeEvent } from "react";
import {
  Search,
  Mic,
  Settings,
  X,
  ChevronUp,
  Globe,
  TrendingUp,
  Cpu,
  BookOpen,
  Briefcase,
  Microscope,
  CornerDownLeft,
  Volume2,
  RefreshCw,
  ExternalLink,
  Shield,
  Newspaper,
  Layers,
  Radio,
} from "lucide-react";
import { OrbitLogo } from "../icons";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { openUrl } from "@tauri-apps/plugin-opener";
import { dbService, type Article, type SyncReport } from "../../services/dbService";
import { isTauriEnvironment } from "../../services/tauriBridge";
import type { CategoryId, UserPreferences, CategoriesPreferences } from "../../types/desktop";
import type { AccentThemeConfig } from "../../utils/accentThemes";

interface ExpandedIslandProps {
  onCollapse: () => void;
  onOpenSettings: () => void;
  onCloseWindow: () => void;
  preferences: UserPreferences;
  accent: AccentThemeConfig;
}

type NewsFilterCategory = "all" | "world" | "business" | "finance" | "technology" | "ai" | "science" | "cybersecurity";

export function ExpandedIsland({
  onCollapse,
  onOpenSettings,
  onCloseWindow,
  preferences,
  accent,
}: ExpandedIslandProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // View mode: "news" (live RSS articles) or "categories" (overview cards)
  const [activeView, setActiveView] = useState<"news" | "categories">("news");
  const [newsFilter, setNewsFilter] = useState<NewsFilterCategory>("all");

  // Articles state
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Fetch articles from SQLite
  const loadArticles = useCallback(async () => {
    setIsLoadingArticles(true);
    try {
      const cat = newsFilter === "all" ? undefined : newsFilter;
      const search = searchQuery.trim() ? searchQuery.trim() : undefined;
      const list = await dbService.getArticlesPaginated(cat, search, 40, 0);
      setArticles(list);
    } catch (err) {
      console.warn("Failed to load articles from SQLite:", err);
    } finally {
      setIsLoadingArticles(false);
    }
  }, [newsFilter, searchQuery]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Trigger manual RSS synchronization
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncStatus("Fetching live feeds...");
    try {
      const report: SyncReport = await dbService.syncNewsFeeds();
      const newCount = Number(report.new_articles);
      if (newCount > 0) {
        setSyncStatus(`Updated • ${newCount} new dispatches`);
      } else {
        setSyncStatus("All feeds up-to-date");
      }
      if (report.errors && report.errors.length > 0) {
        setSyncError(`Warning: ${report.errors.length} feeds had timeouts or errors`);
      }
      await loadArticles();
    } catch (err) {
      setSyncError("Network sync failed. Showing cached dispatches.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Open canonical URL in default web browser
  const handleOpenArticle = async (url: string) => {
    try {
      if (isTauriEnvironment()) {
        await openUrl(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.warn("Could not open article link:", err);
    }
  };

  const allCategories = [
    {
      id: "world-news" as CategoryId,
      prefKey: "world_news" as keyof CategoriesPreferences,
      title: "World News",
      desc: "Global geopolitics, breaking dispatches & diplomatic developments",
      badge: "Realtime",
      icon: <Globe className="w-4 h-4" />,
      suggestion: "Summarize top geopolitical events and diplomatic negotiations today",
    },
    {
      id: "finance-markets" as CategoryId,
      prefKey: "finance_markets" as keyof CategoriesPreferences,
      title: "Finance & Markets",
      desc: "Equities, macro indicators, currencies, commodities & bonds",
      badge: "Pulse",
      icon: <TrendingUp className="w-4 h-4" />,
      suggestion: "What are key market indices, crude oil, and inflation trends today?",
    },
    {
      id: "technology-ai" as CategoryId,
      prefKey: "technology_ai" as keyof CategoriesPreferences,
      title: "Technology & AI",
      desc: "Autonomous systems, frontier models, semiconductor architecture",
      badge: "Frontier",
      icon: <Cpu className="w-4 h-4" />,
      suggestion: "Recent breakthroughs in reasoning AI models and silicon chipsets",
    },
    {
      id: "daily-knowledge" as CategoryId,
      prefKey: "daily_knowledge" as keyof CategoriesPreferences,
      title: "Daily Knowledge",
      desc: "Mental models, scientific principles, philosophy & deep insights",
      badge: "Synthesis",
      icon: <BookOpen className="w-4 h-4" />,
      suggestion: "Explain game theory and Pareto efficiency in concise layman terms",
    },
    {
      id: "business" as CategoryId,
      prefKey: "business" as keyof CategoriesPreferences,
      title: "Business & Startups",
      desc: "Venture ecosystems, enterprise acquisitions & funding rounds",
      badge: "Venture",
      icon: <Briefcase className="w-4 h-4" />,
      suggestion: "Top commercial mergers and venture funding rounds this week",
    },
    {
      id: "science" as CategoryId,
      prefKey: "science" as keyof CategoriesPreferences,
      title: "Science & Space",
      desc: "Astrophysics, clean energy fusion, biomedical frontiers & quantum",
      badge: "Frontiers",
      icon: <Microscope className="w-4 h-4" />,
      suggestion: "Recent breakthroughs in fusion energy and quantum materials",
    },
  ];

  // Filter categories based on preferences
  const activeCategories = allCategories.filter(
    (cat) => preferences.categories[cat.prefKey]
  );

  const handleSelectCategory = (id: CategoryId, suggestion: string) => {
    if (selectedCategory === id) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(id);
      setSearchQuery(suggestion);
      inputRef.current?.focus();
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSubmittedQuery(searchQuery.trim());
      loadArticles();
    }
  };

  const handleMicClick = () => {
    setMicActive(true);
    setTimeout(() => setMicActive(false), 1400);
  };

  // Helper for human-readable relative time
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "Recent";
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "Recent";
    }
  };

  const filterTabs: Array<{ id: NewsFilterCategory; label: string }> = [
    { id: "all", label: "All Feeds" },
    { id: "world", label: "World" },
    { id: "technology", label: "Technology" },
    { id: "ai", label: "AI" },
    { id: "finance", label: "Finance" },
    { id: "business", label: "Business" },
    { id: "science", label: "Science" },
    { id: "cybersecurity", label: "Cybersecurity" },
  ];

  return (
    <Card
      onClick={(e) => e.stopPropagation()}
      className="w-[660px] max-h-[520px] p-0 gap-0 bg-[#07080b]/98 border-white/[0.09] hover:border-white/[0.13] rounded-3xl overflow-hidden backdrop-blur-2xl transition-all duration-300 text-neutral-200 select-none ring-1 ring-white/[0.04] flex flex-col"
    >
      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-5 pt-3 pb-2 cursor-move bg-gradient-to-b from-white/[0.02] to-transparent border-b border-white/[0.06] shrink-0"
      >
        {/* Brand & View Toggle */}
        <div className="flex items-center space-x-3" data-tauri-drag-region="false">
          <div className="flex items-center space-x-2 pointer-events-none">
            <div
              className={`w-6 h-6 rounded-full ${accent.bgSubtle} border ${accent.borderSubtle} flex items-center justify-center ${accent.text} shadow-sm ${accent.glow}`}
            >
              <OrbitLogo className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-white">
              Orbit
            </span>
          </div>

          <Separator orientation="vertical" className="h-3.5 bg-white/[0.1]" />

          {/* View Mode Switcher */}
          <div className="flex items-center space-x-1 bg-black/40 p-0.5 rounded-xl border border-white/[0.06]">
            <Button
              variant={activeView === "news" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setActiveView("news")}
              className={`h-5 px-2 text-[10px] rounded-lg gap-1 ${
                activeView === "news"
                  ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle} font-medium`
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Radio className="w-2.5 h-2.5" />
              <span>Live Dispatches</span>
            </Button>

            <Button
              variant={activeView === "categories" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setActiveView("categories")}
              className={`h-5 px-2 text-[10px] rounded-lg gap-1 ${
                activeView === "categories"
                  ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle} font-medium`
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Layers className="w-2.5 h-2.5" />
              <span>Streams</span>
            </Button>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-1" data-tauri-drag-region="false">
          {/* Manual RSS Sync Button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={isSyncing}
                  onClick={handleManualSync}
                  className={`rounded-lg transition-all ${
                    isSyncing ? "text-amber-400" : `text-neutral-400 hover:${accent.textLight} hover:bg-white/[0.06]`
                  }`}
                />
              }
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isSyncing ? "Syncing RSS feeds..." : "Manual Feed Sync (Refresh)"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onOpenSettings}
                  className={`text-neutral-400 hover:${accent.textLight} hover:bg-white/[0.06] rounded-lg`}
                />
              }
            >
              <Settings className="w-3.5 h-3.5" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Settings & Feed Manager</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onCollapse}
                  className="text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] rounded-lg"
                />
              }
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Collapse to Pill (Esc)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onCloseWindow}
                  className="text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                />
              }
            >
              <X className="w-3.5 h-3.5" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Hide to Tray</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── Main Content Area ──────────────────────────────────────────── */}
      <CardContent className="px-5 py-3 flex-1 flex flex-col space-y-2.5 overflow-hidden min-h-0">
        {/* Search & Question Input */}
        <form
          onSubmit={handleSearchSubmit}
          className={`group relative flex items-center bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl px-3.5 py-1.5 shadow-inner transition-all duration-200 shrink-0 ${accent.ring}`}
        >
          <Search className={`w-3.5 h-3.5 text-neutral-400 group-focus-within:${accent.text} mr-2.5 shrink-0 transition-colors`} />

          <Input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder={
              activeView === "news"
                ? "Search dispatches across trusted publishers..."
                : "What would you like to know today?"
            }
            className="h-7 border-0 bg-transparent px-0 py-0 text-xs font-medium text-white placeholder:text-neutral-500 focus-visible:ring-0 focus-visible:border-0 shadow-none"
          />

          <div className="flex items-center space-x-1 shrink-0 ml-2">
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setSearchQuery("");
                  inputRef.current?.focus();
                }}
                className="text-neutral-400 hover:text-white rounded-md"
                title="Clear input"
              >
                <X className="w-3 h-3" />
              </Button>
            )}

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleMicClick}
                    className={`rounded-lg transition-all duration-200 ${
                      micActive
                        ? `${accent.bgActive} ${accent.textLight} ring-1 ${accent.borderSubtle} animate-pulse`
                        : "text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  />
                }
              >
                {micActive ? <Volume2 className={`w-3 h-3 ${accent.textLight}`} /> : <Mic className="w-3 h-3" />}
              </TooltipTrigger>
              <TooltipContent side="top">Voice Query</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-xs"
                    disabled={!searchQuery.trim()}
                    className="text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-lg disabled:opacity-40"
                  />
                }
              >
                <CornerDownLeft className="w-3 h-3" />
              </TooltipTrigger>
              <TooltipContent side="top">Execute Filter (Enter)</TooltipContent>
            </Tooltip>
          </div>
        </form>

        {/* Sync Status / Error Banner */}
        {syncStatus && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center justify-between animate-in fade-in duration-150 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {syncStatus}
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setSyncStatus(null)}
              className="h-4 px-1 text-[9px] text-emerald-400 hover:text-emerald-200"
            >
              ✕
            </Button>
          </div>
        )}

        {syncError && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300 flex items-center justify-between animate-in fade-in duration-150 shrink-0">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-amber-400" />
              {syncError}
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setSyncError(null)}
              className="h-4 px-1 text-[9px] text-amber-400 hover:text-amber-200"
            >
              ✕
            </Button>
          </div>
        )}

        {/* Submitted Query Feedback Pill */}
        {submittedQuery && (
          <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-neutral-300 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2 truncate">
              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot} shrink-0`} />
              <span className="truncate text-[11px]">
                Filter applied: <strong className="text-white font-medium">"{submittedQuery}"</strong>
              </span>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSubmittedQuery(null);
                setSearchQuery("");
                loadArticles();
              }}
              className="h-4 px-1 text-[9px] text-neutral-400 hover:text-white"
            >
              Reset ✕
            </Button>
          </div>
        )}

        {/* ── VIEW 1: LIVE NEWS DISPATCHES ──────────────────────────────── */}
        {activeView === "news" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            {/* Category Filter Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 shrink-0 no-scrollbar">
              {filterTabs.map((tab) => {
                const isSelected = newsFilter === tab.id;
                return (
                  <Button
                    key={tab.id}
                    variant={isSelected ? "secondary" : "ghost"}
                    size="xs"
                    onClick={() => setNewsFilter(tab.id)}
                    className={`h-6 px-2.5 text-[10px] rounded-lg shrink-0 transition-all ${
                      isSelected
                        ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle} font-semibold shadow-xs`
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </div>

            {/* Articles List (Scrollable) */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
              {isLoadingArticles ? (
                <div className="space-y-2 py-2">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse space-y-1.5"
                    >
                      <div className="h-3 w-32 bg-white/[0.08] rounded" />
                      <div className="h-4 w-full bg-white/[0.05] rounded" />
                      <div className="h-3 w-4/5 bg-white/[0.03] rounded" />
                    </div>
                  ))}
                </div>
              ) : articles.length > 0 ? (
                articles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => handleOpenArticle(art.article_url)}
                    className="group p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.14] transition-all cursor-pointer space-y-1"
                  >
                    {/* Card Header: Publisher, Category, Time */}
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-white/90 group-hover:text-amber-300 transition-colors">
                          {art.publisher || "Trusted Publisher"}
                        </span>
                        <span>•</span>
                        <Badge
                          variant="outline"
                          className="h-3.5 px-1 py-0 text-[8px] uppercase tracking-wider bg-white/[0.04] border-white/[0.08] text-neutral-300 rounded"
                        >
                          {art.category}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-1 text-neutral-500">
                        <span>{formatTime(art.published_at || art.fetched_at)}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-neutral-300" />
                      </div>
                    </div>

                    {/* Article Title */}
                    <h3 className="text-xs font-medium text-white group-hover:text-amber-200 transition-colors leading-snug line-clamp-2">
                      {art.title}
                    </h3>

                    {/* Description snippet */}
                    {art.description && (
                      <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                        {art.description}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                  <Newspaper className="w-8 h-8 text-neutral-500 stroke-[1.2]" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-white">No articles found in this stream</p>
                    <p className="text-[10px] text-neutral-400">
                      Sync from verified publishers to populate your SQLite news archive.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={isSyncing}
                    onClick={handleManualSync}
                    className={`h-7 text-xs ${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight}`}
                  >
                    <RefreshCw className={`w-3 h-3 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>{isSyncing ? "Syncing..." : "Sync Feeds Now"}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VIEW 2: CATEGORICAL OVERVIEW STREAMS ─────────────────────── */}
        {activeView === "categories" && (
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {activeCategories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 pb-1">
                {activeCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <Card
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.id, cat.suggestion)}
                      className={`p-3 gap-2 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? `${accent.bgSubtle} ${accent.borderActive} shadow-sm ${accent.glow}`
                          : `bg-[#0b0c10]/80 hover:bg-[#11131a]/90 border-white/[0.07] ${accent.hoverBorder}`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                              isSelected
                                ? `${accent.bgActive} ${accent.textLight} border ${accent.borderSubtle}`
                                : "bg-white/[0.04] text-neutral-400 border border-white/[0.06]"
                            }`}
                          >
                            {cat.icon}
                          </div>
                          <span className="text-xs font-semibold text-white group-hover:text-amber-200 transition-colors">
                            {cat.title}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`h-4 px-1.5 py-0 text-[9px] font-medium uppercase rounded-full ${
                            isSelected
                              ? `${accent.bgActive} ${accent.textLight} border ${accent.borderSubtle}`
                              : "bg-white/[0.04] text-neutral-400 border-white/[0.06]"
                          }`}
                        >
                          {cat.badge}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                        {cat.desc}
                      </p>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-2">
                <p className="text-xs text-neutral-400">
                  All intelligence category streams are currently disabled.
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={onOpenSettings}
                  className={`text-xs ${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight}`}
                >
                  Configure Intelligence Streams in Settings
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Separator className="bg-white/[0.06]" />

      {/* ── Footer Telemetry Bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-black/40 text-[10px] text-neutral-400 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>
            {articles.length} dispatches archived in SQLite • WAL Synchronized
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-neutral-500">
            Toggle:{" "}
            <kbd className={`px-1.5 py-0.5 rounded bg-white/[0.06] ${accent.textLight} font-mono text-[9px]`}>
              {preferences.global_shortcut}
            </kbd>
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={onCollapse}
            className={`h-5 px-2 ${accent.textLight} hover:bg-white/[0.06] gap-1`}
          >
            <span>Collapse</span>
            <ChevronUp className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
