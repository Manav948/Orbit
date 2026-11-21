import { useState, useRef, useEffect, useCallback, type FormEvent, type ChangeEvent } from "react";
import {
  Search,
  Mic,
  Settings,
  X,
  ChevronUp,
  ChevronDown,
  BookOpen,
  CornerDownLeft,
  Volume2,
  RefreshCw,
  ExternalLink,
  Shield,
  Newspaper,
  Radio,
  Sparkles,
  Bot,
  ArrowUpRight,
  CheckCircle2,
  ArrowDownUp,
  Filter,
  AlertTriangle,
  MessageSquarePlus,
  ChevronRight,
} from "lucide-react";
import { OrbitLogo } from "../icons";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  dbService,
  type Article,
  type SyncReport,
  type StoryClusterWithArticles,
  type Briefing,
  type AiAnswer,
} from "../../services/dbService";
import { isTauriEnvironment } from "../../services/tauriBridge";
import type { UserPreferences } from "../../types/desktop";
import type { AccentThemeConfig } from "../../utils/accentThemes";

interface ExpandedIslandProps {
  onCollapse: () => void;
  onOpenSettings: () => void;
  onCloseWindow: () => void;
  preferences: UserPreferences;
  accent: AccentThemeConfig;
}

type IslandViewMode = "intelligence" | "briefings" | "news";
type NewsFilterCategory = "all" | "world" | "business" | "finance" | "technology" | "ai" | "science" | "cybersecurity";
type ExplanationMode = "simple" | "detailed" | "decision";
type BriefingType = "morning" | "latest" | "overnight" | "technology" | "finance" | "world";
type BriefingDuration = "short" | "standard" | "detailed";
type SortMode = "latest" | "importance";
type DateFilter = "all" | "today" | "24h" | "7d";

const PAGE_SIZE = 20;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function isWithinDateFilter(dateStr: string | null, filter: DateFilter): boolean {
  if (filter === "all" || !dateStr) return true;
  const articleDate = new Date(dateStr).getTime();
  const now = Date.now();
  if (filter === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return articleDate >= startOfDay.getTime();
  }
  if (filter === "24h") return now - articleDate <= 86_400_000;
  if (filter === "7d") return now - articleDate <= 7 * 86_400_000;
  return true;
}

function getImportanceBadge(title: string, publisher: string | null | undefined) {
  const lc = title.toLowerCase();
  const majorPublishers = ["reuters", "bbc", "ap", "associated press", "bloomberg", "wsj", "ft"];
  const isBreaking =
    lc.includes("breaking") ||
    lc.includes("urgent") ||
    lc.includes("alert") ||
    lc.includes("crisis") ||
    lc.includes("emergency");
  const isTop = !isBreaking && majorPublishers.some((p) => (publisher || "").toLowerCase().includes(p));
  if (isBreaking) return { label: "Breaking", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" };
  if (isTop) return { label: "Top Source", cls: "bg-sky-400/15 text-sky-300 border-sky-400/30" };
  return { label: "Dispatch", cls: "bg-white/[0.04] text-neutral-400 border-white/[0.08]" };
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExpandedIsland({
  onCollapse,
  onOpenSettings,
  onCloseWindow,
  preferences,
  accent,
}: ExpandedIslandProps) {
  // ── Navigation & View ──────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<IslandViewMode>("intelligence");
  const [newsFilter, setNewsFilter] = useState<NewsFilterCategory>("all");
  const [explanationMode, setExplanationMode] = useState<ExplanationMode>("simple");

  // ── Search & Ask Nexora ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<AiAnswer | null>(null);
  const [answerViewMode, setAnswerViewMode] = useState<"direct" | "simple" | "decision">("direct");
  const [micActive, setMicActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Publisher Filter & Sort ───────────────────────────────────────────────
  const [publishers, setPublishers] = useState<string[]>([]);
  const [publisherFilter, setPublisherFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // ── AI Story Clusters ─────────────────────────────────────────────────────
  const [stories, setStories] = useState<StoryClusterWithArticles[]>([]);
  const [isLoadingStories, setIsLoadingStories] = useState(true);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [expandedStoryId, setExpandedStoryId] = useState<number | null>(null);

  // ── Daily Briefings ───────────────────────────────────────────────────────
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [briefingsError, setBriefingsError] = useState<string | null>(null);
  const [selectedBriefingType, setSelectedBriefingType] = useState<BriefingType>("morning");
  const [selectedBriefingLength, setSelectedBriefingLength] = useState<BriefingDuration>("standard");
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [activeBriefing, setActiveBriefing] = useState<Briefing | null>(null);

  // ── Raw Articles ──────────────────────────────────────────────────────────
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [articlesError, setArticlesError] = useState<string | null>(null);
  const [articleOffset, setArticleOffset] = useState(0);
  const [hasMoreArticles, setHasMoreArticles] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Sync Status ───────────────────────────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [totalArticleCount, setTotalArticleCount] = useState(0);

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loaders
  // ─────────────────────────────────────────────────────────────────────────

  const loadPublishers = useCallback(async () => {
    try {
      const list = await dbService.getPublishers();
      setPublishers(list);
    } catch {
      // non-critical, fail silently
    }
  }, []);

  const loadStories = useCallback(
    async (forceRefresh = false) => {
      setIsLoadingStories(true);
      setStoriesError(null);
      try {
        const cat = newsFilter === "all" ? undefined : newsFilter;
        const sq = searchQuery.trim() || undefined;
        const data = forceRefresh
          ? await dbService.processNewsIntelligence(cat, 30, true)
          : await dbService.getAiStories(cat, sq, sortMode === "importance" ? "importance" : undefined, 20);

        if (data.length === 0 && !forceRefresh) {
          const processed = await dbService.processNewsIntelligence(cat, 30, false);
          setStories(processed);
          if (processed.length > 0) setExpandedStoryId(processed[0].cluster.id);
        } else {
          setStories(data);
          if (data.length > 0 && expandedStoryId === null) setExpandedStoryId(data[0].cluster.id);
        }
      } catch (err) {
        setStoriesError(err instanceof Error ? err.message : "Failed to load AI story clusters.");
      } finally {
        setIsLoadingStories(false);
      }
    },
    [newsFilter, searchQuery, sortMode, expandedStoryId]
  );

  const loadArticles = useCallback(
    async (reset = true) => {
      const isReset = reset;
      if (isReset) {
        setIsLoadingArticles(true);
        setArticlesError(null);
        setArticleOffset(0);
      } else {
        setIsLoadingMore(true);
      }
      try {
        const cat = newsFilter === "all" ? undefined : newsFilter;
        const pub = publisherFilter === "all" ? undefined : publisherFilter;
        const sq = searchQuery.trim() || undefined;
        const offset = isReset ? 0 : articleOffset;
        const list = await dbService.getArticlesPaginated(cat, pub, sq, sortMode, PAGE_SIZE + 1, offset);
        const hasMore = list.length > PAGE_SIZE;
        const page = hasMore ? list.slice(0, PAGE_SIZE) : list;
        // Client-side date filtering (no backend change needed)
        const filtered = page.filter((a) => isWithinDateFilter(a.published_at || a.fetched_at, dateFilter));
        if (isReset) {
          setArticles(filtered);
          setTotalArticleCount(filtered.length);
        } else {
          setArticles((prev) => [...prev, ...filtered]);
          setTotalArticleCount((prev) => prev + filtered.length);
        }
        setHasMoreArticles(hasMore);
        setArticleOffset(offset + page.length);
      } catch (err) {
        setArticlesError(err instanceof Error ? err.message : "Failed to load dispatches.");
      } finally {
        setIsLoadingArticles(false);
        setIsLoadingMore(false);
      }
    },
    [newsFilter, publisherFilter, searchQuery, sortMode, dateFilter, articleOffset]
  );

  const loadBriefings = useCallback(async () => {
    setBriefingsError(null);
    try {
      const list = await dbService.getBriefings(undefined, undefined, 10);
      setBriefings(list);
      if (list.length > 0 && !activeBriefing) {
        setActiveBriefing(list[0]);
      }
    } catch (err) {
      setBriefingsError(err instanceof Error ? err.message : "Failed to load briefings.");
    }
  }, [activeBriefing]);

  // ── On mount: load publishers
  useEffect(() => {
    loadPublishers();
  }, [loadPublishers]);

  // ── Reload when active view or key filters change
  useEffect(() => {
    if (activeView === "intelligence") {
      loadStories();
    } else if (activeView === "news") {
      loadArticles(true);
    } else if (activeView === "briefings") {
      loadBriefings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, newsFilter, publisherFilter, sortMode, dateFilter]);

  // ─────────────────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncStatus("Fetching live feeds...");
    try {
      const report: SyncReport = await dbService.syncNewsFeeds();
      const newCount = Number(report.new_articles);
      setSyncStatus(newCount > 0 ? `Updated • ${newCount} new dispatches` : "All feeds up-to-date");
      if (report.errors && report.errors.length > 0) {
        setSyncError(`Warning: ${report.errors.length} feeds had timeouts or errors`);
      }
      await loadArticles(true);
      if (activeView === "intelligence") await loadStories(true);
    } catch {
      setSyncError("Network sync failed. Showing cached dispatches.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleProcessAiIntelligence = async () => {
    if (isProcessingAi) return;
    setIsProcessingAi(true);
    setStoriesError(null);
    try {
      await loadStories(true);
      setSyncStatus("AI Intelligence clusters updated");
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err) {
      setStoriesError(err instanceof Error ? err.message : "Failed to update AI intelligence clusters.");
    } finally {
      setIsProcessingAi(false);
    }
  };

  const handleGenerateBriefing = async () => {
    if (isGeneratingBriefing) return;
    setIsGeneratingBriefing(true);
    setBriefingsError(null);
    try {
      const briefing = await dbService.generateBriefing(selectedBriefingType, selectedBriefingLength);
      setActiveBriefing(briefing);
      await loadBriefings();
      setSyncStatus(`Generated ${briefing.title}`);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err) {
      setBriefingsError(err instanceof Error ? err.message : "Failed to compile briefing. Check API key in Settings > AI Configuration.");
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  const handleQuestionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    if (activeView === "news") {
      loadArticles(true);
      return;
    }

    setIsAskingAi(true);
    setAiAnswer(null);
    try {
      const answer = await dbService.askQuestion(query);
      setAiAnswer(answer);
      setAnswerViewMode("direct");
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Ask Nexora failed. Ensure AI is configured in Settings.");
    } finally {
      setIsAskingAi(false);
    }
  };

  const handleAskAboutStory = (cluster: StoryClusterWithArticles["cluster"]) => {
    const ctx = `${cluster.what_happened}\n\n${cluster.why_it_matters}`;
    setSearchQuery(cluster.title);
    setActiveView("intelligence");
    setAiAnswer(null);
    // Submit automatically
    setIsAskingAi(true);
    dbService
      .askQuestion(cluster.title, ctx)
      .then((answer) => {
        setAiAnswer(answer);
        setAnswerViewMode("direct");
      })
      .catch((err) => {
        setSyncError(err instanceof Error ? err.message : "Ask Nexora failed.");
      })
      .finally(() => setIsAskingAi(false));
  };

  const handleOpenArticle = async (url: string) => {
    try {
      if (isTauriEnvironment()) {
        await openUrl(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      // fail silently
    }
  };

  const handleMicClick = () => {
    setMicActive(true);
    setTimeout(() => setMicActive(false), 1400);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMoreArticles) {
      loadArticles(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "Recent";
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return "Recent";
    }
  };

  const filterTabs: Array<{ id: NewsFilterCategory; label: string }> = [
    { id: "all", label: "All Topics" },
    { id: "world", label: "World" },
    { id: "technology", label: "Technology" },
    { id: "ai", label: "AI" },
    { id: "finance", label: "Finance" },
    { id: "business", label: "Business" },
    { id: "science", label: "Science" },
    { id: "cybersecurity", label: "Cyber" },
  ];

  const activeFiltersCount =
    (publisherFilter !== "all" ? 1 : 0) +
    (sortMode !== "latest" ? 1 : 0) +
    (dateFilter !== "all" ? 1 : 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Card
      onClick={(e) => e.stopPropagation()}
      className="w-[680px] max-h-[520px] p-0 gap-0 bg-[#07080b]/98 border-white/[0.09] hover:border-white/[0.13] rounded-3xl overflow-hidden backdrop-blur-2xl transition-all duration-300 text-neutral-200 select-none ring-1 ring-white/[0.04] flex flex-col"
    >
      {/* ── Top Header Bar ──────────────────────────────────────────────── */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-5 pt-3 pb-2 cursor-move bg-gradient-to-b from-white/[0.02] to-transparent border-b border-white/[0.06] shrink-0"
      >
        {/* Brand & View Mode Toggle */}
        <div className="flex items-center space-x-3" data-tauri-drag-region="false">
          <div className="flex items-center space-x-2 pointer-events-none">
            <div
              className={`w-6 h-6 rounded-full ${accent.bgSubtle} border ${accent.borderSubtle} flex items-center justify-center ${accent.text} shadow-sm ${accent.glow}`}
            >
              <OrbitLogo className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-white">
              Orbit Intelligence
            </span>
          </div>

          <Separator orientation="vertical" className="h-3.5 bg-white/[0.1]" />

          {/* Tri-View Switcher */}
          <div className="flex items-center space-x-0.5 bg-black/40 p-0.5 rounded-xl border border-white/[0.06]">
            <Button
              variant={activeView === "intelligence" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setActiveView("intelligence")}
              className={`h-5 px-2 text-[10px] rounded-lg gap-1 ${
                activeView === "intelligence"
                  ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle} font-medium`
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
              <span>AI Stories</span>
            </Button>

            <Button
              variant={activeView === "briefings" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setActiveView("briefings")}
              className={`h-5 px-2 text-[10px] rounded-lg gap-1 ${
                activeView === "briefings"
                  ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle} font-medium`
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <BookOpen className="w-2.5 h-2.5" />
              <span>Briefings</span>
            </Button>

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
              <span>Dispatches</span>
            </Button>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-1" data-tauri-drag-region="false">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={isSyncing || isProcessingAi}
                  onClick={activeView === "intelligence" ? handleProcessAiIntelligence : handleManualSync}
                  className={`rounded-lg transition-all ${
                    isSyncing || isProcessingAi
                      ? "text-amber-400"
                      : `text-neutral-400 hover:${accent.textLight} hover:bg-white/[0.06]`
                  }`}
                />
              }
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isProcessingAi ? "animate-spin" : ""}`} />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {activeView === "intelligence" ? "Re-process AI Intelligence" : "Sync RSS Feeds"}
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
            <TooltipContent side="bottom">Settings & AI Configuration</TooltipContent>
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

        {/* ── Dashboard Greeting Header ──────────────────────────────── */}
        <div className="flex items-center justify-between shrink-0">
          <div className="space-y-0">
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest">{getTodayLabel()}</p>
            <p className="text-xs font-semibold text-white leading-tight">
              {getGreeting()} —{" "}
              <span className={accent.textLight}>
                {stories.length > 0
                  ? `${stories.length} stories synthesized`
                  : "Ready for your intelligence briefing"}
              </span>
            </p>
          </div>
          <div className="flex items-center space-x-2 text-[10px] text-neutral-500">
            {articles.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {totalArticleCount} dispatches
              </span>
            )}
            {briefings.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                {briefings.length} briefings
              </span>
            )}
          </div>
        </div>

        {/* ── Ask Nexora Interactive Input ───────────────────────────── */}
        <form
          onSubmit={handleQuestionSubmit}
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
                ? "Search raw dispatches by keyword or publisher..."
                : "Ask Nexora (e.g. Why did NVIDIA decline? What happened in AI?)..."
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
                  setAiAnswer(null);
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
                    disabled={!searchQuery.trim() || isAskingAi}
                    className="text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-lg disabled:opacity-40"
                  />
                }
              >
                {isAskingAi ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                ) : (
                  <CornerDownLeft className="w-3 h-3" />
                )}
              </TooltipTrigger>
              <TooltipContent side="top">Ask Nexora (Enter)</TooltipContent>
            </Tooltip>
          </div>
        </form>

        {/* Sync / Notification Status Banner */}
        {syncStatus && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center justify-between animate-in fade-in duration-150 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {syncStatus}
            </span>
            <Button variant="ghost" size="xs" onClick={() => setSyncStatus(null)} className="h-4 px-1 text-[9px] text-emerald-400 hover:text-emerald-200">
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
            <Button variant="ghost" size="xs" onClick={() => setSyncError(null)} className="h-4 px-1 text-[9px] text-amber-400 hover:text-amber-200">
              ✕
            </Button>
          </div>
        )}

        {/* ── CONVERSATIONAL Q&A RESULT CARD ────────────────────────── */}
        {aiAnswer && (
          <div className="p-3.5 rounded-2xl bg-[#0e1017] border border-amber-400/30 shadow-lg space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-[9px] bg-amber-400/15 text-amber-300 border-amber-400/30 gap-1">
                  <Bot className="w-2.5 h-2.5" />
                  <span>Verified Answer</span>
                </Badge>
                <span className="text-[11px] font-medium text-white truncate max-w-[300px]">
                  &ldquo;{aiAnswer.question}&rdquo;
                </span>
              </div>

              <div className="flex items-center space-x-1">
                {/* Perspective Mode Switcher */}
                <div className="flex items-center space-x-0.5 bg-black/40 p-0.5 rounded-lg border border-white/[0.06]">
                  {(["direct", "simple", "decision"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAnswerViewMode(mode)}
                      className={`px-1.5 py-0.5 text-[9px] rounded font-medium cursor-pointer ${
                        answerViewMode === mode
                          ? "bg-amber-400/20 text-amber-200"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {mode === "direct" ? "Direct" : mode === "simple" ? "Beginner" : "Strategic"}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setAiAnswer(null)}
                  className="text-neutral-400 hover:text-white h-5 w-5 rounded"
                >
                  ✕
                </Button>
              </div>
            </div>

            <p className="text-xs text-neutral-200 leading-relaxed">
              {answerViewMode === "direct"
                ? aiAnswer.answer
                : answerViewMode === "simple"
                ? aiAnswer.simple_explanation || aiAnswer.answer
                : aiAnswer.decision_explanation || aiAnswer.answer}
            </p>

            {aiAnswer.sources && aiAnswer.sources.length > 0 && (
              <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                <span className="text-neutral-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Grounded in {aiAnswer.sources.length} verified dispatches:</span>
                </span>
                <div className="flex items-center space-x-1.5 overflow-x-auto">
                  {aiAnswer.sources.slice(0, 3).map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => handleOpenArticle(src.article_url)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-amber-300/90 hover:text-amber-200 border border-white/[0.06] text-[9px] cursor-pointer"
                    >
                      <span>{src.publisher || "Source"}</span>
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW 1: AI STORY INTELLIGENCE CLUSTERS
        ══════════════════════════════════════════════════════════════ */}
        {activeView === "intelligence" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            {/* Filter Pills & Explanation Mode Switcher */}
            <div className="flex items-center justify-between shrink-0 pb-1 gap-2">
              <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
                {filterTabs.map((tab) => {
                  const isSelected = newsFilter === tab.id;
                  return (
                    <Button
                      key={tab.id}
                      variant={isSelected ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => setNewsFilter(tab.id)}
                      className={`h-5 px-2 text-[10px] rounded-lg shrink-0 transition-all ${
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

              <div className="flex items-center space-x-1 shrink-0">
                {/* Sort toggle */}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => setSortMode((prev) => (prev === "latest" ? "importance" : "latest"))}
                        className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded-lg border cursor-pointer transition-all ${
                          sortMode === "importance"
                            ? `${accent.bgSubtle} ${accent.textLight} ${accent.borderSubtle}`
                            : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:text-white"
                        }`}
                      />
                    }
                  >
                    <ArrowDownUp className="w-2.5 h-2.5" />
                    <span>{sortMode === "importance" ? "Impact" : "Latest"}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Toggle sort: Latest / Impact</TooltipContent>
                </Tooltip>

                {/* 3-Mode Explanation Selector */}
                <div className="flex items-center space-x-0.5 bg-black/40 p-0.5 rounded-lg border border-white/[0.06]">
                  {(["simple", "detailed", "decision"] as ExplanationMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setExplanationMode(mode)}
                      className={`px-2 py-0.5 text-[9px] rounded font-medium transition-all cursor-pointer ${
                        explanationMode === mode
                          ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle}`
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error State */}
            {storiesError && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="flex-1">{storiesError}</span>
                <button type="button" onClick={() => setStoriesError(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer">✕</button>
              </div>
            )}

            {/* Story Intelligence Clusters List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
              {isLoadingStories ? (
                <div className="space-y-2 py-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse space-y-2">
                      <div className="flex justify-between">
                        <div className="h-3 w-28 bg-white/[0.08] rounded" />
                        <div className="h-3 w-16 bg-white/[0.06] rounded" />
                      </div>
                      <div className="h-4 w-5/6 bg-white/[0.05] rounded" />
                      <div className="h-10 w-full bg-white/[0.03] rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : stories.length > 0 ? (
                stories.map(({ cluster, articles: clusterArticles }) => {
                  const isExpanded = expandedStoryId === cluster.id;
                  const activeExplanation =
                    explanationMode === "simple"
                      ? cluster.simple_summary || cluster.what_happened
                      : explanationMode === "detailed"
                      ? cluster.detailed_summary || cluster.why_it_happened
                      : cluster.decision_summary || cluster.why_it_matters;

                  return (
                    <div
                      key={cluster.id}
                      className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.035] border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-2.5"
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center space-x-1.5">
                          <Badge variant="outline" className="h-4 px-1.5 py-0 text-[8px] uppercase tracking-wider bg-white/[0.04] border-white/[0.08] text-neutral-300 rounded font-semibold">
                            {cluster.category}
                          </Badge>

                          <Badge
                            variant="outline"
                            className={`h-4 px-1.5 py-0 text-[8px] font-semibold rounded gap-1 ${
                              cluster.importance_score >= 80
                                ? "bg-amber-400/15 text-amber-300 border-amber-400/30"
                                : "bg-sky-400/15 text-sky-300 border-sky-400/30"
                            }`}
                          >
                            ★ {cluster.importance_score} Impact
                          </Badge>

                          {clusterArticles.length > 1 && (
                            <span className="text-[9px] text-neutral-400">
                              • {clusterArticles.length} sources
                            </span>
                          )}
                        </div>

                        <span className="text-neutral-500 text-[10px]">{formatTime(cluster.created_at)}</span>
                      </div>

                      {/* Headline */}
                      <h3 className="text-xs font-semibold text-white leading-snug">{cluster.title}</h3>

                      {/* Mode Explanation Preview */}
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05] space-y-1">
                        <div className="flex items-center justify-between text-[9px] font-medium text-amber-300/90">
                          <span className="uppercase tracking-wider">{explanationMode} Intelligence Perspective</span>
                          <span className="text-neutral-500 font-mono text-[8px]">{cluster.model_used}</span>
                        </div>
                        <p className="text-[11px] text-neutral-200 leading-relaxed">{activeExplanation}</p>
                      </div>

                      {/* 5-Part Structured Analysis */}
                      <div className="space-y-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setExpandedStoryId(isExpanded ? null : cluster.id)}
                          className="w-full flex items-center justify-between text-[10px] text-neutral-400 hover:text-white py-1 cursor-pointer"
                        >
                          <span className="font-medium flex items-center gap-1 text-neutral-300">
                            <span>Deep 5-Point Verification Analysis</span>
                            <span className="text-neutral-500 text-[9px]">(Why, Impact, Future & Uncertainties)</span>
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="grid grid-cols-1 gap-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                            {[
                              { icon: "📌", label: "What happened?", text: cluster.what_happened },
                              { icon: "🔍", label: "Why did it happen?", text: cluster.why_it_happened },
                              { icon: "⚡", label: "Why does it matter?", text: cluster.why_it_matters },
                              { icon: "🔭", label: "What happens next?", text: cluster.what_happens_next },
                              { icon: "❓", label: "What is uncertain?", text: cluster.what_is_uncertain },
                            ].map(({ icon, label, text }) => (
                              <div key={label} className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-0.5 text-[11px]">
                                <span className="font-semibold text-white flex items-center gap-1">
                                  <span>{icon} {label}</span>
                                </span>
                                <p className="text-neutral-300 text-[10px] leading-relaxed">{text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer: Publisher Links + Ask About This Story */}
                      <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-[10px]">
                        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
                          {clusterArticles.slice(0, 4).map((art) => (
                            <button
                              key={art.id}
                              type="button"
                              onClick={() => handleOpenArticle(art.article_url)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/[0.06] text-[9px] cursor-pointer"
                            >
                              <span>{art.publisher || "Wire"}</span>
                              <ArrowUpRight className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          ))}
                        </div>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={() => handleAskAboutStory(cluster)}
                                disabled={isAskingAi}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium cursor-pointer transition-all ${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle} hover:opacity-80 disabled:opacity-40`}
                              />
                            }
                          >
                            <MessageSquarePlus className="w-2.5 h-2.5" />
                            <span>Ask Nexora</span>
                          </TooltipTrigger>
                          <TooltipContent side="top">Ask Nexora about this story</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                  <Sparkles className="w-8 h-8 text-amber-400/80 stroke-[1.2]" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-white">No AI Story Clusters Available</p>
                    <p className="text-[10px] text-neutral-400">
                      Synchronize live feeds or trigger AI synthesis to generate intelligence breakdowns.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={isProcessingAi}
                    onClick={handleProcessAiIntelligence}
                    className={`h-7 text-xs ${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight}`}
                  >
                    <RefreshCw className={`w-3 h-3 mr-1.5 ${isProcessingAi ? "animate-spin" : ""}`} />
                    <span>{isProcessingAi ? "Synthesizing..." : "Generate AI Intelligence"}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW 2: EXECUTIVE DAILY BRIEFINGS
        ══════════════════════════════════════════════════════════════ */}
        {activeView === "briefings" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
            {/* Briefing Controls */}
            <div className="flex items-center justify-between shrink-0 gap-2 pb-1">
              <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: "morning", label: "Morning" },
                    { id: "latest", label: "Latest" },
                    { id: "overnight", label: "Overnight" },
                    { id: "technology", label: "Tech & AI" },
                    { id: "finance", label: "Finance" },
                    { id: "world", label: "World" },
                  ] as Array<{ id: BriefingType; label: string }>
                ).map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedBriefingType(type.id)}
                    className={`px-2 py-1 text-[10px] rounded-lg font-medium transition-all cursor-pointer ${
                      selectedBriefingType === type.id
                        ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle}`
                        : "text-neutral-400 hover:text-white bg-white/[0.02]"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <select
                  value={selectedBriefingLength}
                  onChange={(e) => setSelectedBriefingLength(e.target.value as BriefingDuration)}
                  className="h-6 text-[10px] bg-black/60 border border-white/[0.1] rounded-lg px-2 text-neutral-300 focus:outline-none"
                >
                  <option value="short">Short (2m)</option>
                  <option value="standard">Standard (5m)</option>
                  <option value="detailed">Detailed (10m)</option>
                </select>

                <Button
                  size="xs"
                  disabled={isGeneratingBriefing}
                  onClick={handleGenerateBriefing}
                  className="h-6 text-[10px] px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold gap-1 cursor-pointer"
                >
                  <Sparkles className={`w-3 h-3 ${isGeneratingBriefing ? "animate-spin" : ""}`} />
                  <span>{isGeneratingBriefing ? "Compiling..." : "Generate"}</span>
                </Button>
              </div>
            </div>

            {/* Error State */}
            {briefingsError && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="flex-1">{briefingsError}</span>
                <button type="button" onClick={() => setBriefingsError(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer">✕</button>
              </div>
            )}

            {/* Archived Briefings Selector */}
            {briefings.length > 1 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[10px] shrink-0 no-scrollbar">
                <span className="text-neutral-500 text-[9px] shrink-0">Archive:</span>
                {briefings.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setActiveBriefing(b)}
                    className={`px-2 py-0.5 rounded-md text-[9px] truncate max-w-[150px] cursor-pointer transition-all flex items-center gap-1 ${
                      activeBriefing?.id === b.id
                        ? "bg-amber-400/20 text-amber-200 border border-amber-400/30"
                        : "bg-white/[0.03] text-neutral-400 hover:text-white border border-white/[0.05]"
                    }`}
                  >
                    <ChevronRight className="w-2.5 h-2.5 opacity-60 shrink-0" />
                    <span className="truncate">{b.title}</span>
                    {b.briefing_length && (
                      <span className="shrink-0 text-[8px] opacity-60">
                        {b.briefing_length === "short" ? "2m" : b.briefing_length === "standard" ? "5m" : "10m"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Briefing Display */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-0 space-y-2">
              {activeBriefing ? (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-amber-300 text-xs">{activeBriefing.title}</span>
                    <div className="flex items-center space-x-2 text-neutral-400">
                      {activeBriefing.articles_count != null && (
                        <span className="text-[9px]">{activeBriefing.articles_count} sources</span>
                      )}
                      <Badge variant="outline" className="text-[8px] bg-white/[0.04] border-white/[0.08]">
                        {activeBriefing.model_used || "gpt-4o-mini"}
                      </Badge>
                      <span>{formatTime(activeBriefing.created_at)}</span>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap space-y-2 font-sans">
                    {activeBriefing.summary}
                  </div>
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                  <BookOpen className="w-8 h-8 text-neutral-500 stroke-[1.2]" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-white">No Briefings Generated Yet</p>
                    <p className="text-[10px] text-neutral-400">
                      Select your intelligence stream and length above to synthesize a personalized executive briefing.
                    </p>
                  </div>
                  <Button
                    size="xs"
                    disabled={isGeneratingBriefing}
                    onClick={handleGenerateBriefing}
                    className="h-7 text-xs bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 mr-1.5" />
                    <span>Compile First Briefing</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW 3: LIVE RAW DISPATCHES STREAM
        ══════════════════════════════════════════════════════════════ */}
        {activeView === "news" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            {/* Category Filter Pills Row */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 shrink-0 no-scrollbar">
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

            {/* Advanced Filter Bar */}
            <div className="flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center space-x-1.5">
                {/* Publisher Filter */}
                {publishers.length > 0 && (
                  <select
                    value={publisherFilter}
                    onChange={(e) => setPublisherFilter(e.target.value)}
                    className="h-6 text-[9px] bg-black/60 border border-white/[0.1] rounded-lg px-2 text-neutral-300 focus:outline-none max-w-[130px]"
                  >
                    <option value="all">All Publishers</option>
                    {publishers.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}

                {/* Date Filter */}
                <div className="flex items-center space-x-0.5 bg-black/40 p-0.5 rounded-lg border border-white/[0.06]">
                  {(["all", "today", "24h", "7d"] as DateFilter[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDateFilter(d)}
                      className={`px-1.5 py-0.5 text-[9px] rounded font-medium cursor-pointer transition-all ${
                        dateFilter === d
                          ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle}`
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {d === "all" ? "All" : d === "today" ? "Today" : d === "24h" ? "24h" : "7d"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort & Filter toggle */}
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setSortMode((prev) => (prev === "latest" ? "importance" : "latest"))}
                  className={`flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-lg border cursor-pointer transition-all ${
                    sortMode === "importance"
                      ? `${accent.bgSubtle} ${accent.textLight} ${accent.borderSubtle}`
                      : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:text-white"
                  }`}
                >
                  <ArrowDownUp className="w-2.5 h-2.5" />
                  <span>{sortMode === "importance" ? "By Impact" : "By Latest"}</span>
                </button>

                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPublisherFilter("all");
                      setSortMode("latest");
                      setDateFilter("all");
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:text-rose-200 cursor-pointer"
                  >
                    <Filter className="w-2.5 h-2.5" />
                    <span>Clear ({activeFiltersCount})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Error State */}
            {articlesError && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="flex-1">{articlesError}</span>
                <button type="button" onClick={() => setArticlesError(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer">✕</button>
              </div>
            )}

            {/* Articles List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
              {isLoadingArticles ? (
                <div className="space-y-2 py-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse space-y-1.5">
                      <div className="h-3 w-32 bg-white/[0.08] rounded" />
                      <div className="h-4 w-full bg-white/[0.05] rounded" />
                      <div className="h-3 w-4/5 bg-white/[0.03] rounded" />
                    </div>
                  ))}
                </div>
              ) : articles.length > 0 ? (
                <>
                  {articles.map((art) => {
                    const badge = getImportanceBadge(art.title, art.publisher);
                    return (
                      <div
                        key={art.id}
                        onClick={() => handleOpenArticle(art.article_url)}
                        className="group p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.14] transition-all cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-neutral-400">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-white/90 group-hover:text-amber-300 transition-colors">
                              {art.publisher || "Trusted Publisher"}
                            </span>
                            <span>•</span>
                            <Badge variant="outline" className="h-3.5 px-1 py-0 text-[8px] uppercase tracking-wider bg-white/[0.04] border-white/[0.08] text-neutral-300 rounded">
                              {art.category}
                            </Badge>
                            <Badge variant="outline" className={`h-3.5 px-1 py-0 text-[8px] rounded ${badge.cls}`}>
                              {badge.label}
                            </Badge>
                          </div>

                          <div className="flex items-center space-x-1 text-neutral-500">
                            <span>{formatTime(art.published_at || art.fetched_at)}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-neutral-300" />
                          </div>
                        </div>

                        <h3 className="text-xs font-medium text-white group-hover:text-amber-200 transition-colors leading-snug line-clamp-2">
                          {art.title}
                        </h3>

                        {art.description && (
                          <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                            {art.description}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Load More / Pagination */}
                  {hasMoreArticles && (
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className={`w-full py-2 text-[10px] rounded-xl border transition-all cursor-pointer ${
                        isLoadingMore
                          ? "text-neutral-500 border-white/[0.04] bg-white/[0.01]"
                          : `text-neutral-400 hover:text-white border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]`
                      }`}
                    >
                      {isLoadingMore ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Loading more dispatches...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1.5">
                          Load more dispatches <ChevronDown className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  )}
                </>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                  <Newspaper className="w-8 h-8 text-neutral-500 stroke-[1.2]" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-white">No articles found in this stream</p>
                    <p className="text-[10px] text-neutral-400">
                      {activeFiltersCount > 0
                        ? "Try clearing the active filters or syncing new feeds."
                        : "Sync from verified publishers to populate your SQLite news archive."}
                    </p>
                  </div>
                  {activeFiltersCount > 0 ? (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => { setPublisherFilter("all"); setSortMode("latest"); setDateFilter("all"); }}
                      className="h-7 text-xs border-white/[0.1] text-neutral-300"
                    >
                      Clear all filters
                    </Button>
                  ) : (
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
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <Separator className="bg-white/[0.06]" />

      {/* ── Footer Telemetry Bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-black/40 text-[10px] text-neutral-400 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>
            {stories.length} AI Clusters • {totalArticleCount > 0 ? totalArticleCount : articles.length} Dispatches • {briefings.length} Briefings
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-neutral-500">
            Shortcut:{" "}
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
