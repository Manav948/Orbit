import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
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
} from "lucide-react";
import { OrbitLogo } from "../icons";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { CategoryId, UserPreferences, CategoriesPreferences } from "../../types/desktop";
import type { AccentThemeConfig } from "../../utils/accentThemes";

interface ExpandedIslandProps {
  onCollapse: () => void;
  onOpenSettings: () => void;
  onCloseWindow: () => void;
  preferences: UserPreferences;
  accent: AccentThemeConfig;
}

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

  // Dynamically filter categories based on user preferences
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
    }
  };

  const handleMicClick = () => {
    setMicActive(true);
    setTimeout(() => setMicActive(false), 1400);
  };

  return (
    <Card
      onClick={(e) => e.stopPropagation()}
      className="w-[660px] max-h-[515px] p-0 gap-0 bg-[#07080b]/98 border-white/[0.09] hover:border-white/[0.13] rounded-3xl overflow-hidden backdrop-blur-2xl transition-all duration-300 text-neutral-200 select-none ring-1 ring-white/[0.04]"
    >
      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-5 pt-3.5 pb-2.5 cursor-move bg-gradient-to-b from-white/[0.02] to-transparent border-b border-white/[0.06]"
      >
        {/* Brand */}
        <div className="flex items-center space-x-2.5 pointer-events-none">
          <div
            className={`w-6 h-6 rounded-full ${accent.bgSubtle} border ${accent.borderSubtle} flex items-center justify-center ${accent.text} shadow-sm ${accent.glow}`}
          >
            <OrbitLogo className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-xs tracking-tight text-white">
              Orbit Intelligence
            </span>

          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center space-x-1.5" data-tauri-drag-region="false">

          {/* Action Icons using shadcn Button & Tooltip */}
          <div className="flex items-center space-x-0.5 ml-1">
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
              <TooltipContent side="bottom">Settings & Personalization</TooltipContent>
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
      </div>

      {/* ── Main Body ──────────────────────────────────────────────────── */}
      <CardContent className="px-5 py-3.5 flex flex-col space-y-3.5 overflow-y-auto">
        {/* Search & Question Input with shadcn Input & Button */}
        <form
          onSubmit={handleSearchSubmit}
          className={`group relative flex items-center bg-white border border-neutral-300 hover:border-neutral-400 rounded-2xl px-3.5 py-1.5 shadow-inner transition-all duration-200 ${accent.ring}`}
        >
          <Search className={`w-4 h-4 text-neutral-600 group-focus-within:${accent.text} mr-2.5 shrink-0 transition-colors`} />

          <Input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="What would you like to know today?"
            className="h-8 border-0 bg-transparent px-0 py-0 text-xs font-medium text-neutral-950 placeholder:text-neutral-500 focus-visible:ring-0 focus-visible:border-0 shadow-none"
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
                className="text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-md"
                title="Clear input"
              >
                <X className="w-3 h-3" />
              </Button>
            )}

            {/* Voice Dictation Button */}
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
                        : "text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100"
                    }`}
                  />
                }
              >
                {micActive ? <Volume2 className={`w-3.5 h-3.5 ${accent.textLight}`} /> : <Mic className="w-3.5 h-3.5" />}
              </TooltipTrigger>
              <TooltipContent side="top">Voice Query</TooltipContent>
            </Tooltip>

            {/* Submit Icon Button */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-xs"
                    disabled={!searchQuery.trim()}
                    className="text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg disabled:opacity-40"
                  />
                }
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
              </TooltipTrigger>
              <TooltipContent side="top">Execute Query (Enter)</TooltipContent>
            </Tooltip>
          </div>
        </form>

        {/* Submitted Query Feedback Pill */}
        {submittedQuery && (
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-neutral-300 flex items-center justify-between">
            <div className="flex items-center space-x-2 truncate">
              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot} shrink-0`} />
              <span className="truncate text-[11px]">
                Query registered: <strong className="text-white font-medium">"{submittedQuery}"</strong>
              </span>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setSubmittedQuery(null)}
              className="h-5 px-1.5 text-[10px] text-neutral-400 hover:text-white"
            >
              Dismiss ✕
            </Button>
          </div>
        )}

        {/* Categorical Cards Grid - Respects User Preferences */}
        {activeCategories.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
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
      </CardContent>

      <Separator className="bg-white/[0.06]" />

      {/* ── Footer Telemetry Bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-black/40 text-[10px] text-neutral-400">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Briefing updated • All telemetry nominal</span>
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
