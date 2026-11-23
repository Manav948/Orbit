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
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Square,
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
  type Conversation,
  type ConversationMessage,
  type StockQuote,
} from "../../services/dbService";
import { isTauriEnvironment } from "../../services/tauriBridge";
import { voiceService } from "../../services/voiceService";
import { ttsService } from "../../services/ttsService";
import type { UserPreferences } from "../../types/desktop";
import type { AccentThemeConfig } from "../../utils/accentThemes";

interface ExpandedIslandProps {
  onCollapse: () => void;
  onOpenSettings: () => void;
  onCloseWindow: () => void;
  preferences: UserPreferences;
  accent: AccentThemeConfig;
}

type IslandViewMode = "intelligence" | "assistant" | "briefings" | "finance" | "news";
type NewsFilterCategory = "all" | "world" | "business" | "finance" | "technology" | "ai" | "science" | "cybersecurity";
type ExplanationMode = "simple" | "detailed" | "decision";
type BriefingType = "morning" | "latest" | "overnight" | "technology" | "finance" | "world";
type BriefingDuration = "short" | "standard" | "detailed";
type SortMode = "latest" | "importance";
type DateFilter = "all" | "today" | "24h" | "7d";

const PAGE_SIZE = 20;

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

  // ── AI Story Clusters ─────────────────────────────────────────────────────
  const [stories, setStories] = useState<StoryClusterWithArticles[]>([]);
  const [isLoadingStories, setIsLoadingStories] = useState(true);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [isProcessingAi, setIsProcessingAi] = useState(false);

  // ── Daily Briefings ───────────────────────────────────────────────────────
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [briefingsError, setBriefingsError] = useState<string | null>(null);
  const [selectedBriefingType, setSelectedBriefingType] = useState<BriefingType>("morning");
  const [selectedBriefingLength, setSelectedBriefingLength] = useState<BriefingDuration>("standard");
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [activeBriefing, setActiveBriefing] = useState<Briefing | null>(null);

  // ── Conversational Assistant State ────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [assistantMicActive, setAssistantMicActive] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Finance Intelligence State ────────────────────────────────────────────
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [quickAddSymbol, setQuickAddSymbol] = useState("");

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
  const [totalArticleCount, setTotalArticleCount] = useState(0);

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loaders
  // ─────────────────────────────────────────────────────────────────────────

  const loadPublishers = useCallback(async () => {
    try {
      const list = await dbService.getPublishers();
      setPublishers(list);
    } catch {
      // non-critical
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
        } else {
          setStories(data);
        }
      } catch (err) {
        setStoriesError(err instanceof Error ? err.message : "Failed to load AI story clusters.");
      } finally {
        setIsLoadingStories(false);
      }
    },
    [newsFilter, searchQuery, sortMode]
  );

  const loadArticles = useCallback(
    async (reset = true) => {
      if (reset) {
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
        const offset = reset ? 0 : articleOffset;
        const list = await dbService.getArticlesPaginated(cat, pub, sq, sortMode, PAGE_SIZE + 1, offset);
        const hasMore = list.length > PAGE_SIZE;
        const page = hasMore ? list.slice(0, PAGE_SIZE) : list;
        const filtered = page.filter((a) => isWithinDateFilter(a.published_at || a.fetched_at, dateFilter));
        if (reset) {
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

  const loadConversations = useCallback(async () => {
    try {
      const list = await dbService.getConversations(20);
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        setActiveConversationId(list[0].id);
        const msgs = await dbService.getConversationMessages(list[0].id);
        setMessages(msgs);
      }
    } catch (err) {
      console.warn("Failed to load conversations:", err);
    }
  }, [activeConversationId]);

  const loadFinanceQuotes = useCallback(async () => {
    setIsLoadingQuotes(true);
    setFinanceError(null);
    try {
      const data = await dbService.getWatchlistQuotes();
      setQuotes(data);
    } catch (err) {
      setFinanceError(err instanceof Error ? err.message : "Failed to fetch market quotes.");
    } finally {
      setIsLoadingQuotes(false);
    }
  }, []);

  // ── On mount: load publishers
  useEffect(() => {
    loadPublishers();
  }, [loadPublishers]);

  // ── Reload when active view changes
  useEffect(() => {
    if (activeView === "intelligence") {
      loadStories();
    } else if (activeView === "news") {
      loadArticles(true);
    } else if (activeView === "briefings") {
      loadBriefings();
    } else if (activeView === "assistant") {
      loadConversations();
    } else if (activeView === "finance") {
      loadFinanceQuotes();
    }
  }, [activeView, loadStories, loadArticles, loadBriefings, loadConversations, loadFinanceQuotes]);

  // Scroll to bottom of assistant messages
  useEffect(() => {
    if (activeView === "assistant") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeView]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
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
      setBriefingsError(err instanceof Error ? err.message : "Failed to compile briefing. Check AI settings.");
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
      if (ttsService.isAutoSpeakEnabled()) {
        ttsService.speak(answer.answer);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Ask Nexora failed.");
    } finally {
      setIsAskingAi(false);
    }
  };

  // ── Assistant Chat Handlers ───────────────────────────────────────────────
  const handleSendAssistant = async (e: FormEvent) => {
    e.preventDefault();
    const text = assistantInput.trim();
    if (!text || isSendingMessage) return;

    setIsSendingMessage(true);
    setAssistantInput("");

    // Optimistically add user message to feed
    const tempUserMsg: ConversationMessage = {
      id: Date.now(),
      conversation_id: activeConversationId || 0,
      role: "user",
      content: text,
      created_at: "Just now",
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const reply = await dbService.sendAssistantMessage(text, activeConversationId || undefined);
      setActiveConversationId(reply.conversation_id);

      const assistantMsg: ConversationMessage = {
        id: reply.message_id,
        conversation_id: reply.conversation_id,
        role: "assistant",
        content: reply.content,
        sources_json: reply.sources.length > 0 ? JSON.stringify(reply.sources) : undefined,
        created_at: reply.created_at,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      await loadConversations();

      if (ttsService.isAutoSpeakEnabled()) {
        ttsService.speak(reply.content);
      }
    } catch (err) {
      const errMsg: ConversationMessage = {
        id: Date.now() + 1,
        conversation_id: activeConversationId || 0,
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Assistant response failed. Check Settings > Multi-Provider AI."}`,
        created_at: "Just now",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSelectConversation = async (id: number) => {
    setActiveConversationId(id);
    try {
      const msgs = await dbService.getConversationMessages(id);
      setMessages(msgs);
    } catch {
      // ignore
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setAssistantInput("");
  };

  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await dbService.deleteConversation(id);
      if (activeConversationId === id) {
        handleNewConversation();
      }
      await loadConversations();
    } catch {
      // ignore
    }
  };

  const handleToggleTts = (text: string, msgId: number) => {
    if (playingMessageId === msgId) {
      ttsService.stop();
      setPlayingMessageId(null);
    } else {
      setPlayingMessageId(msgId);
      ttsService.speak(text, () => setPlayingMessageId(null));
    }
  };

  // ── Voice Input Handlers ──────────────────────────────────────────────────
  const handleMicSearch = () => {
    if (micActive) {
      voiceService.stopListening();
      setMicActive(false);
    } else {
      setMicActive(true);
      const started = voiceService.startListening(
        (transcript) => setSearchQuery(transcript),
        (err) => {
          setSyncError(err);
          setMicActive(false);
        },
        () => setMicActive(false)
      );
      if (!started) setMicActive(false);
    }
  };

  const handleMicAssistant = () => {
    if (assistantMicActive) {
      voiceService.stopListening();
      setAssistantMicActive(false);
    } else {
      setAssistantMicActive(true);
      const started = voiceService.startListening(
        (transcript) => setAssistantInput(transcript),
        (err) => {
          setSyncError(err);
          setAssistantMicActive(false);
        },
        () => setAssistantMicActive(false)
      );
      if (!started) setAssistantMicActive(false);
    }
  };

  // ── Finance Handlers ──────────────────────────────────────────────────────
  const handleAddWatchlistTicker = async (e: FormEvent) => {
    e.preventDefault();
    const sym = quickAddSymbol.trim().toUpperCase();
    if (!sym) return;
    try {
      const cfg = await dbService.getFinanceConfig();
      if (!cfg.watchlist.includes(sym)) {
        const updated = [...cfg.watchlist, sym];
        await dbService.saveWatchlist(updated);
        setQuickAddSymbol("");
        await loadFinanceQuotes();
      }
    } catch {
      // ignore
    }
  };

  const handleOpenArticle = async (url: string) => {
    try {
      const trimmed = url.trim();
      if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        console.warn("Blocked non-HTTP link navigation for security:", url);
        return;
      }
      if (isTauriEnvironment()) {
        await openUrl(trimmed);
      } else {
        window.open(trimmed, "_blank", "noopener,noreferrer");
      }
    } catch {
      // ignore
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMoreArticles) {
      loadArticles(false);
    }
  };

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
  ];

  const activeFiltersCount =
    (publisherFilter !== "all" ? 1 : 0) +
    (sortMode !== "latest" ? 1 : 0) +
    (dateFilter !== "all" ? 1 : 0);

  // SVG mini sparkline renderer
  const renderSparkline = (points: number[], isPositive: boolean) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 64;
    const height = 24;

    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathData = `M ${coords.join(" L ")}`;
    const strokeColor = isPositive ? "#34d399" : "#f87171";

    return (
      <svg width={width} height={height} className="shrink-0 overflow-visible">
        <path d={pathData} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  };

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
              Nexora
            </span>
          </div>

          <Separator orientation="vertical" className="h-3.5 bg-white/[0.1]" />

          {/* 5-Mode Switcher */}
          <div className="flex items-center space-x-0.5 bg-black/40 p-0.5 rounded-xl border border-white/[0.06]">
            {[
              { id: "intelligence" as IslandViewMode, label: "AI Stories", icon: <Sparkles className="w-2.5 h-2.5 text-amber-400" /> },
              { id: "assistant" as IslandViewMode, label: "Assistant", icon: <Bot className="w-2.5 h-2.5 text-sky-400" /> },
              { id: "briefings" as IslandViewMode, label: "Briefings", icon: <BookOpen className="w-2.5 h-2.5" /> },
              { id: "finance" as IslandViewMode, label: "Markets", icon: <TrendingUp className="w-2.5 h-2.5 text-emerald-400" /> },
              { id: "news" as IslandViewMode, label: "Dispatches", icon: <Radio className="w-2.5 h-2.5" /> },
            ].map((tab) => {
              const active = activeView === tab.id;
              return (
                <Button
                  key={tab.id}
                  variant={active ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setActiveView(tab.id)}
                  className={`h-5 px-2 text-[10px] rounded-lg gap-1 ${
                    active
                      ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle} font-medium`
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </Button>
              );
            })}
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
                  onClick={
                    activeView === "intelligence"
                      ? handleProcessAiIntelligence
                      : activeView === "finance"
                      ? loadFinanceQuotes
                      : handleManualSync
                  }
                  className={`rounded-lg transition-all ${
                    isSyncing || isProcessingAi
                      ? "text-amber-400"
                      : `text-neutral-400 hover:${accent.textLight} hover:bg-white/[0.06]`
                  }`}
                />
              }
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isProcessingAi || isLoadingQuotes ? "animate-spin" : ""}`} />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {activeView === "intelligence" ? "Re-process AI Intelligence" : activeView === "finance" ? "Refresh Quotes" : "Sync RSS Feeds"}
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
      <CardContent className="px-5 py-3 flex-1 flex flex-col space-y-2 overflow-hidden min-h-0">

        {/* Top greeting header (in non-assistant modes) */}
        {activeView !== "assistant" && (
          <div className="flex items-center justify-between shrink-0">
            <div className="space-y-0">
              <p className="text-[9px] text-neutral-500 uppercase tracking-widest">{getTodayLabel()}</p>
              <p className="text-xs font-semibold text-white leading-tight">
                {getGreeting()} —{" "}
                <span className={accent.textLight}>
                  {stories.length > 0 ? `${stories.length} stories synthesized` : "Ready for your intelligence stream"}
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
              {quotes.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                  {quotes.length} assets
                </span>
              )}
            </div>
          </div>
        )}

        {/* Global Search Bar (used in Stories, Briefings, News) */}
        {activeView !== "assistant" && activeView !== "finance" && (
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
                      onClick={handleMicSearch}
                      className={`rounded-lg transition-all duration-200 ${
                        micActive
                          ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40 animate-pulse"
                          : "text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    />
                  }
                >
                  <Mic className="w-3 h-3" />
                </TooltipTrigger>
                <TooltipContent side="top">Voice Input</TooltipContent>
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
        )}

        {/* Sync / Status Banners */}
        {syncStatus && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {syncStatus}
            </span>
            <Button variant="ghost" size="xs" onClick={() => setSyncStatus(null)} className="h-4 px-1 text-[9px] text-emerald-400">
              ✕
            </Button>
          </div>
        )}

        {syncError && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-amber-400" />
              {syncError}
            </span>
            <Button variant="ghost" size="xs" onClick={() => setSyncError(null)} className="h-4 px-1 text-[9px] text-amber-400">
              ✕
            </Button>
          </div>
        )}

        {/* ── CONVERSATIONAL Q&A RESULT (In Stories View) ──────────────── */}
        {aiAnswer && activeView === "intelligence" && (
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
                      {mode === "direct" ? "Direct" : mode === "simple" ? "Simple" : "Strategic"}
                    </button>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    const textToSpeak =
                      answerViewMode === "simple"
                        ? aiAnswer.simple_explanation || aiAnswer.answer
                        : answerViewMode === "decision"
                        ? aiAnswer.decision_explanation || aiAnswer.answer
                        : aiAnswer.answer;
                    handleToggleTts(textToSpeak, 999999);
                  }}
                  className="text-neutral-400 hover:text-amber-300 h-5 w-5 rounded"
                  title="Speak Answer"
                >
                  <Volume2 className="w-3 h-3" />
                </Button>
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
              {answerViewMode === "simple"
                ? aiAnswer.simple_explanation || aiAnswer.answer
                : answerViewMode === "decision"
                ? aiAnswer.decision_explanation || aiAnswer.answer
                : aiAnswer.answer}
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW 1: AI STORY INTELLIGENCE CLUSTERS
        ══════════════════════════════════════════════════════════════ */}
        {activeView === "intelligence" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            <div className="flex items-center justify-between shrink-0 pb-1 gap-2 min-w-0">
              <div className="flex min-w-0 flex-1 items-center space-x-1 overflow-x-auto no-scrollbar">
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

              <div className="flex items-center gap-1.5 shrink-0">
                <div role="group" aria-label="Story sorting and summary style" className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-black/40 p-0.5">
                  {(["latest", "importance"] as SortMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={sortMode === mode}
                      onClick={() => setSortMode(mode)}
                      className={`flex h-5 items-center gap-1 rounded-md px-1.5 text-[9px] font-medium transition-colors cursor-pointer ${
                        sortMode === mode
                          ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle}`
                          : "border border-transparent text-neutral-400 hover:text-neutral-100"
                      }`}
                    >
                      {mode === "latest" ? <ArrowDownUp className="h-2.5 w-2.5" /> : null}
                      <span>{mode === "latest" ? "Latest" : "Impact"}</span>
                    </button>
                  ))}
                  <span aria-hidden="true" className="mx-0.5 h-3.5 w-px bg-white/10" />
                  {(["simple", "detailed", "decision"] as ExplanationMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={explanationMode === mode}
                      onClick={() => setExplanationMode(mode)}
                      className={`h-5 rounded-md px-1.5 text-[9px] font-medium transition-colors cursor-pointer ${
                        explanationMode === mode
                          ? `${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle}`
                          : "border border-transparent text-neutral-400 hover:text-neutral-100"
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {storiesError && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="flex-1">{storiesError}</span>
              </div>
            )}

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
                    </div>
                  ))}
                </div>
              ) : stories.length > 0 ? (
                stories.map(({ cluster, articles: clusterArticles }) => {
                  const activeExplanation =
                    explanationMode === "simple"
                      ? cluster.simple_summary || cluster.what_happened
                      : explanationMode === "detailed"
                      ? cluster.detailed_summary || cluster.why_it_happened
                      : cluster.decision_summary || cluster.why_it_matters;

                  return (
                    <div
                      key={cluster.id}
                      className="p-3.5 rounded-2xl bg-white/[0.025] hover:bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] transition-all space-y-2"
                    >
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

                      <h3 className="text-sm font-semibold text-white leading-snug">{cluster.title}</h3>

                      <div className={`space-y-1 border-l-2 ${accent.borderSubtle} pl-3 py-0.5`}>
                        <div className={`text-[10px] font-semibold uppercase tracking-wider ${accent.textLight}`}>Summary</div>
                        <p className="text-[12px] text-neutral-200 leading-relaxed">{activeExplanation}</p>
                      </div>

                      <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-[10px]">
                        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
                          {clusterArticles.slice(0, 3).map((art) => (
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

                        <button
                          type="button"
                          onClick={() => {
                            setActiveView("assistant");
                            setAssistantInput(`Can you explain more about this development: "${cluster.title}"?`);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-medium cursor-pointer ${accent.bgSubtle} ${accent.textLight} border ${accent.borderSubtle}`}
                        >
                          <MessageSquarePlus className="w-2.5 h-2.5" />
                          <span>Chat with Assistant</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                  <Sparkles className="w-8 h-8 text-amber-400/80 stroke-[1.2]" />
                  <p className="text-xs font-medium text-white">No AI Story Clusters Available</p>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleProcessAiIntelligence}
                    className={`h-7 text-xs ${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight}`}
                  >
                    Generate AI Intelligence
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW 2: CONVERSATIONAL AI PERSONAL ASSISTANT
        ══════════════════════════════════════════════════════════════ */}
        {activeView === "assistant" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            {/* Assistant Controls Bar */}
            <div className="flex items-center justify-between shrink-0 pb-1 gap-2">
              <div className="flex items-center space-x-2 truncate">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleNewConversation}
                  className="h-6 px-2 text-[10px] rounded-lg border-white/[0.1] hover:bg-white/[0.06] text-neutral-300 gap-1"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  <span>New Chat</span>
                </Button>

                {conversations.length > 0 && (
                  <select
                    value={activeConversationId || ""}
                    onChange={(e) => handleSelectConversation(Number(e.target.value))}
                    className="h-6 text-[10px] bg-black/60 border border-white/[0.1] rounded-lg px-2 text-neutral-300 max-w-[200px] truncate focus:outline-none"
                  >
                    {conversations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center space-x-2 text-[10px] text-neutral-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Multi-Provider Assistant
                </span>
                {activeConversationId && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => handleDeleteConversation(activeConversationId, e)}
                    className="text-neutral-500 hover:text-rose-400 h-5 w-5"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
              {messages.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                  <Bot className="w-8 h-8 text-sky-400 stroke-[1.2]" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-white">Ask Nexora Assistant</p>
                    <p className="text-[10px] text-neutral-400 max-w-sm">
                      Ask about recent news, current events, technology & AI breakthroughs, or company stock data.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                    {[
                      "What happened in AI this week?",
                      "Summarize recent tech earnings",
                      "Why are chip stocks moving?",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setAssistantInput(prompt);
                        }}
                        className="px-2 py-1 text-[9px] rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 border border-white/[0.06] cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) => {
                  const isUser = m.role === "user";
                  const sources: Article[] = m.sources_json ? JSON.parse(m.sources_json) : [];

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}
                    >
                      <div
                        className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? "bg-white/[0.08] border border-white/[0.12] text-white rounded-br-sm"
                            : "bg-[#0c0e15] border border-white/[0.06] text-neutral-200 rounded-bl-sm space-y-2"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.content}</div>

                        {/* Grounded News Sources Tags */}
                        {sources.length > 0 && (
                          <div className="pt-2 border-t border-white/[0.06] space-y-1">
                            <span className="text-[9px] text-neutral-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Grounded in Verified Dispatches:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {sources.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => handleOpenArticle(s.article_url)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[9px] text-amber-300 border border-white/[0.06] cursor-pointer"
                                >
                                  <span>{s.publisher || "Source"}</span>
                                  <ArrowUpRight className="w-2.5 h-2.5 opacity-60" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {!isUser && (
                          <div className="flex items-center justify-between pt-1 text-[9px] text-neutral-500">
                            <span className="italic">Distinguishes verified news from AI reasoning</span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleToggleTts(m.content, m.id)}
                              className="text-neutral-400 hover:text-amber-300 h-5 w-5"
                              title={playingMessageId === m.id ? "Stop Speech" : "Read Aloud"}
                            >
                              {playingMessageId === m.id ? (
                                <Square className="w-2.5 h-2.5 text-rose-400" />
                              ) : (
                                <Volume2 className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Assistant Input Form with Voice Dictation */}
            <form
              onSubmit={handleSendAssistant}
              className={`group flex items-center bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl px-3 py-1.5 shadow-inner shrink-0 ${accent.ring}`}
            >
              <Input
                type="text"
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                placeholder="Message Nexora Assistant (or click microphone to speak)..."
                className="h-7 border-0 bg-transparent px-0 py-0 text-xs font-medium text-white placeholder:text-neutral-500 focus-visible:ring-0 shadow-none flex-1"
              />

              <div className="flex items-center space-x-1 shrink-0 ml-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={handleMicAssistant}
                        className={`rounded-lg transition-all ${
                          assistantMicActive
                            ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40 animate-pulse"
                            : "text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                        }`}
                      />
                    }
                  >
                    <Mic className="w-3 h-3" />
                  </TooltipTrigger>
                  <TooltipContent side="top">Voice Dictation</TooltipContent>
                </Tooltip>

                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-xs"
                  disabled={!assistantInput.trim() || isSendingMessage}
                  className="text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-lg disabled:opacity-40"
                >
                  {isSendingMessage ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                  ) : (
                    <CornerDownLeft className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW 3: EXECUTIVE DAILY BRIEFINGS
        ══════════════════════════════════════════════════════════════ */}
        {activeView === "briefings" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
            <div className="flex items-center justify-between shrink-0 gap-2 pb-1">
              <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
                {[
                  { id: "morning" as BriefingType, label: "Morning" },
                  { id: "latest" as BriefingType, label: "Latest" },
                  { id: "overnight" as BriefingType, label: "Overnight" },
                  { id: "technology" as BriefingType, label: "Tech & AI" },
                  { id: "finance" as BriefingType, label: "Finance" },
                  { id: "world" as BriefingType, label: "World" },
                ].map((type) => (
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

            {briefingsError && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="flex-1">{briefingsError}</span>
              </div>
            )}

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
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-1 min-h-0 space-y-2">
              {activeBriefing ? (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-amber-300 text-xs">{activeBriefing.title}</span>
                    <div className="flex items-center space-x-2 text-neutral-400">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleToggleTts(activeBriefing.summary, 888888)}
                        className="text-neutral-400 hover:text-amber-300 h-5 w-5"
                        title="Read Briefing Aloud"
                      >
                        <Volume2 className="w-3 h-3" />
                      </Button>
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
                  <p className="text-xs font-medium text-white">No Briefings Generated Yet</p>
                  <Button
                    size="xs"
                    disabled={isGeneratingBriefing}
                    onClick={handleGenerateBriefing}
                    className="h-7 text-xs bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold cursor-pointer"
                  >
                    Compile First Briefing
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW 4: MARKETS & FINANCE INTELLIGENCE
        ══════════════════════════════════════════════════════════════ */}
        {activeView === "finance" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            {/* Quick Watchlist Add Bar */}
            <div className="flex items-center justify-between shrink-0 gap-2 pb-0.5">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Market Watchlist</span>
              </span>

              <form onSubmit={handleAddWatchlistTicker} className="flex items-center space-x-1.5">
                <Input
                  type="text"
                  placeholder="+ Ticker (e.g. NVDA)"
                  value={quickAddSymbol}
                  onChange={(e) => setQuickAddSymbol(e.target.value)}
                  className="h-6 text-[10px] font-mono bg-black/60 border-white/[0.1] rounded-lg px-2 text-white w-28 uppercase"
                />
                <Button
                  type="submit"
                  size="xs"
                  disabled={!quickAddSymbol.trim()}
                  className="h-6 px-2 text-[10px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold"
                >
                  Add
                </Button>
              </form>
            </div>

            {financeError && (
              <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300">
                {financeError}
              </div>
            )}

            {/* Watchlist Stock Cards Grid */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
              {isLoadingQuotes ? (
                <div className="space-y-2 py-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-16 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : quotes.length > 0 ? (
                quotes.map((q) => {
                  const isPositive = q.change >= 0;
                  return (
                    <div
                      key={q.symbol}
                      className="p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] transition-all flex items-center justify-between gap-3"
                    >
                      <div className="truncate min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-white">{q.symbol}</span>
                          <span className="text-[10px] text-neutral-400 truncate">{q.name}</span>
                          {q.is_delayed && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 bg-white/[0.04] text-neutral-400 border-white/[0.08]">
                              Delayed
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-3 text-[10px] text-neutral-500 pt-0.5">
                          <span>Open: ${q.open.toFixed(2)}</span>
                          <span>High: ${q.high.toFixed(2)}</span>
                          <span>Low: ${q.low.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Sparkline mini-chart */}
                      <div className="hidden sm:block shrink-0">
                        {renderSparkline(q.sparkline, isPositive)}
                      </div>

                      {/* Price & Change Badge */}
                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-bold text-white">
                          ${q.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div
                          className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold ${
                            isPositive ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                          <span>
                            {isPositive ? "+" : ""}
                            {q.change.toFixed(2)} ({isPositive ? "+" : ""}
                            {q.change_percent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                  <TrendingUp className="w-8 h-8 text-neutral-500 stroke-[1.2]" />
                  <p className="text-xs font-medium text-white">No Assets in Watchlist</p>
                  <p className="text-[10px] text-neutral-400">
                    Add tickers above or configure your Finnhub key in Settings.
                  </p>
                </div>
              )}
            </div>

            <div className="text-[9px] text-neutral-500 text-center shrink-0 pt-0.5">
              Finnhub / Sample Market Data • Delayed quotes where applicable • Not investment advice
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW 5: LIVE RAW DISPATCHES STREAM
        ══════════════════════════════════════════════════════════════ */}
        {activeView === "news" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
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

            <div className="flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center space-x-1.5">
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

            {articlesError && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="flex-1">{articlesError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
              {isLoadingArticles ? (
                <div className="space-y-2 py-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse space-y-1.5">
                      <div className="h-3 w-32 bg-white/[0.08] rounded" />
                      <div className="h-4 w-full bg-white/[0.05] rounded" />
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

                  {hasMoreArticles && (
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="w-full py-2 text-[10px] rounded-xl border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03] text-neutral-400 hover:text-white transition-all cursor-pointer"
                    >
                      {isLoadingMore ? "Loading more dispatches..." : "Load more dispatches"}
                    </button>
                  )}
                </>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                  <Newspaper className="w-8 h-8 text-neutral-500 stroke-[1.2]" />
                  <p className="text-xs font-medium text-white">No articles found in this stream</p>
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={isSyncing}
                    onClick={handleManualSync}
                    className={`h-7 text-xs ${accent.bgSubtle} border ${accent.borderSubtle} ${accent.textLight}`}
                  >
                    Sync Feeds Now
                  </Button>
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
            {stories.length} AI Stories • {conversations.length} Chats • {quotes.length} Watchlist Assets
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
