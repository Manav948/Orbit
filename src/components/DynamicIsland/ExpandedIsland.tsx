import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import {
  NexoraLogo,
  SearchIcon,
  MicrophoneIcon,
  SettingsIcon,
  CloseIcon,
  ChevronUpIcon,
  GlobeIcon,
  FinanceIcon,
  TechIcon,
  KnowledgeIcon,
  SparklesIcon,
} from "../icons";
import type { CategoryId } from "../../types/desktop";

interface ExpandedIslandProps {
  onCollapse: () => void;
  onOpenSettings: () => void;
  onCloseWindow: () => void;
}

export function ExpandedIsland({
  onCollapse,
  onOpenSettings,
  onCloseWindow,
}: ExpandedIslandProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [activeCategoryTitle, setActiveCategoryTitle] = useState<string | null>(null);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = [
    {
      id: "world-news" as CategoryId,
      title: "World News",
      desc: "Global geopolitics, breaking dispatches & diplomatic developments",
      badge: "Realtime",
      icon: <GlobeIcon className="w-4 h-4" />,
      suggestion: "Summarize top geopolitical events and diplomatic negotiations today",
    },
    {
      id: "finance-markets" as CategoryId,
      title: "Finance & Markets",
      desc: "Equities, macro indicators, currencies, commodities & bonds",
      badge: "Market Pulse",
      icon: <FinanceIcon className="w-4 h-4" />,
      suggestion: "What are key market indices, crude oil, and inflation trends today?",
    },
    {
      id: "technology-ai" as CategoryId,
      title: "Technology & AI",
      desc: "Autonomous systems, frontier models, semiconductor architecture",
      badge: "Frontier",
      icon: <TechIcon className="w-4 h-4" />,
      suggestion: "Recent breakthroughs in reasoning AI models and silicon chipsets",
    },
    {
      id: "daily-knowledge" as CategoryId,
      title: "Daily Knowledge",
      desc: "Mental models, scientific principles, philosophy & deep insights",
      badge: "Synthesis",
      icon: <KnowledgeIcon className="w-4 h-4" />,
      suggestion: "Explain game theory and Pareto efficiency in concise layman terms",
    },
  ];

  const handleSelectCategory = (id: CategoryId, title: string, suggestion: string) => {
    if (selectedCategory === id) {
      setSelectedCategory(null);
      setActiveCategoryTitle(null);
    } else {
      setSelectedCategory(id);
      setActiveCategoryTitle(title);
      setSearchQuery(suggestion);
      inputRef.current?.focus();
    }
  };

  const handleClearCategory = () => {
    setSelectedCategory(null);
    setActiveCategoryTitle(null);
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSubmittedQuery(searchQuery.trim());
    }
  };

  const handleMicClick = () => {
    setMicActive(true);
    setTimeout(() => setMicActive(false), 1400);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-[660px] max-h-[510px] flex flex-col bg-[#07080b]/98 border border-white/[0.09] hover:border-white/[0.13] rounded-3xl shadow-2xl shadow-black/95 overflow-hidden backdrop-blur-2xl transition-all duration-300 text-neutral-200 select-none"
    >
      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-5 pt-3.5 pb-2.5 border-b border-white/[0.06] cursor-move bg-gradient-to-b from-white/[0.02] to-transparent"
      >
        {/* Brand & Mode */}
        <div className="flex items-center space-x-2.5 pointer-events-none">
          <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shadow-amber-500/20">
            <NexoraLogo className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-xs tracking-tight text-white">
              Nexora Intelligence
            </span>
            <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25">
              Island Mode
            </span>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-black/40 border border-white/[0.06] pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] font-medium text-neutral-400">
            4 Channels Synced
          </span>
        </div>

        {/* Window Actions */}
        <div className="flex items-center space-x-1" data-tauri-drag-region="false">
          <button
            type="button"
            onClick={onOpenSettings}
            title="Open Full Preferences & Settings"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onCollapse}
            title="Collapse to Dynamic Island Pill (Esc)"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <ChevronUpIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onCloseWindow}
            title="Hide Window to System Tray"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main Body ──────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 flex flex-col space-y-3.5 overflow-y-auto">
        {/* Category Context Filter Tag (if active) */}
        {activeCategoryTitle && (
          <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 animate-in fade-in duration-150">
            <span className="flex items-center space-x-1.5">
              <SparklesIcon className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[11px]">
                Active Focus: <strong className="font-semibold text-amber-300">{activeCategoryTitle}</strong>
              </span>
            </span>
            <button
              type="button"
              onClick={handleClearCategory}
              className="text-[10px] font-medium text-amber-300/80 hover:text-amber-100 transition-colors cursor-pointer"
            >
              Reset ✕
            </button>
          </div>
        )}

        {/* Search & Question Input */}
        <form
          onSubmit={handleSearchSubmit}
          className="group relative flex items-center bg-[#0c0d12]/90 border border-white/[0.08] hover:border-white/[0.14] focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/30 rounded-2xl px-3.5 py-2.5 shadow-inner transition-all duration-200"
        >
          <SearchIcon className="w-4 h-4 text-neutral-400 group-focus-within:text-amber-400 mr-2.5 shrink-0 transition-colors" />

          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="What would you like to know today?"
            className="flex-1 bg-transparent text-xs font-medium text-white placeholder-neutral-500 focus:outline-none"
          />

          <div className="flex items-center space-x-1.5 shrink-0 ml-2">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  inputRef.current?.focus();
                }}
                className="p-1 text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                title="Clear input"
              >
                ✕
              </button>
            )}

            {/* Microphone Button */}
            <button
              type="button"
              onClick={handleMicClick}
              title={micActive ? "Listening (Voice query simulation)..." : "Voice Input"}
              className={`p-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
                micActive
                  ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50 animate-pulse"
                  : "text-neutral-400 hover:text-amber-300 hover:bg-white/[0.06]"
              }`}
            >
              <MicrophoneIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Submitted Query Feedback Pill */}
        {submittedQuery && (
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-neutral-300 flex items-center justify-between">
            <div className="flex items-center space-x-2 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="truncate text-[11px]">
                Query registered: <strong className="text-white font-medium">"{submittedQuery}"</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSubmittedQuery(null)}
              className="text-[10px] text-neutral-400 hover:text-white shrink-0 ml-2 cursor-pointer"
            >
              Dismiss ✕
            </button>
          </div>
        )}

        {/* 4 Category Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.id, cat.title, cat.suggestion)}
                className={`group text-left p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? "bg-amber-500/[0.08] border-amber-500/40 shadow-sm shadow-amber-500/10"
                    : "bg-[#0b0c10]/80 hover:bg-[#11131a]/90 border-white/[0.07] hover:border-amber-500/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                          : "bg-white/[0.04] text-neutral-400 group-hover:text-amber-300 border border-white/[0.06]"
                      }`}
                    >
                      {cat.icon}
                    </div>
                    <span className="text-xs font-semibold text-white group-hover:text-amber-200 transition-colors">
                      {cat.title}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-medium uppercase px-1.5 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                        : "bg-white/[0.04] text-neutral-400 border border-white/[0.06]"
                    }`}
                  >
                    {cat.badge}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                  {cat.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Footer Briefing Status Bar ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.06] bg-black/40 text-[10px] text-neutral-400">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Briefing updated • All telemetry nominal</span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-neutral-500">Toggle: <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-neutral-300 font-mono text-[9px]">Alt+Space</kbd></span>
          <button
            type="button"
            onClick={onCollapse}
            className="flex items-center space-x-1 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <span>Collapse</span>
            <ChevronUpIcon className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

