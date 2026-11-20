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
  Sparkles,
  Layers,
  Check,
  CornerDownLeft,
  Volume2,
} from "lucide-react";
import { NexoraLogo } from "../icons";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
  const [activeModel, setActiveModel] = useState("Nexora-Frontier-Core");
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = [
    {
      id: "world-news" as CategoryId,
      title: "World News",
      desc: "Global geopolitics, breaking dispatches & diplomatic developments",
      badge: "Realtime",
      icon: <Globe className="w-4 h-4" />,
      suggestion: "Summarize top geopolitical events and diplomatic negotiations today",
    },
    {
      id: "finance-markets" as CategoryId,
      title: "Finance & Markets",
      desc: "Equities, macro indicators, currencies, commodities & bonds",
      badge: "Market Pulse",
      icon: <TrendingUp className="w-4 h-4" />,
      suggestion: "What are key market indices, crude oil, and inflation trends today?",
    },
    {
      id: "technology-ai" as CategoryId,
      title: "Technology & AI",
      desc: "Autonomous systems, frontier models, semiconductor architecture",
      badge: "Frontier",
      icon: <Cpu className="w-4 h-4" />,
      suggestion: "Recent breakthroughs in reasoning AI models and silicon chipsets",
    },
    {
      id: "daily-knowledge" as CategoryId,
      title: "Daily Knowledge",
      desc: "Mental models, scientific principles, philosophy & deep insights",
      badge: "Synthesis",
      icon: <BookOpen className="w-4 h-4" />,
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
    <Card
      onClick={(e) => e.stopPropagation()}
      className="w-[660px] max-h-[515px] p-0 gap-0 bg-[#07080b]/98 border-white/[0.09] hover:border-white/[0.13] rounded-3xl shadow-2xl shadow-black/95 overflow-hidden backdrop-blur-2xl transition-all duration-300 text-neutral-200 select-none ring-1 ring-white/[0.04]"
    >
      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-5 pt-3.5 pb-2.5 cursor-move bg-gradient-to-b from-white/[0.02] to-transparent border-b border-white/[0.06]"
      >
        {/* Brand & Mode Badges */}
        <div className="flex items-center space-x-2.5 pointer-events-none">
          <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shadow-amber-500/20">
            <NexoraLogo className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-xs tracking-tight text-white">
              Nexora Intelligence
            </span>
            <Badge
              variant="outline"
              className="h-4 px-1.5 py-0 text-[9px] font-semibold tracking-wider uppercase bg-amber-500/10 text-amber-300 border-amber-500/30 rounded-full"
            >
              Island Mode
            </Badge>
          </div>
        </div>

        {/* Quick Channel / Model Switcher with shadcn DropdownMenu */}
        <div className="flex items-center space-x-1.5" data-tauri-drag-region="false">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="xs"
                  className="h-5 px-2 bg-black/40 border-white/[0.08] hover:bg-white/[0.06] text-[10px] text-neutral-300 gap-1.5 rounded-full"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="font-medium">{activeModel}</span>
                  <Layers className="w-2.5 h-2.5 text-neutral-400" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48 bg-[#0c0d12]/98 border-white/[0.1] text-xs">
              <DropdownMenuLabel className="text-[10px] uppercase text-neutral-400 font-semibold tracking-wider">
                Reasoning Engine
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setActiveModel("Nexora-Frontier-Core")}
                className="flex items-center justify-between text-xs text-neutral-200 cursor-pointer"
              >
                <span>Nexora-Frontier-Core</span>
                {activeModel === "Nexora-Frontier-Core" && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveModel("Nexora-Fast-Latency")}
                className="flex items-center justify-between text-xs text-neutral-200 cursor-pointer"
              >
                <span>Nexora-Fast-Latency</span>
                {activeModel === "Nexora-Fast-Latency" && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem
                onClick={onOpenSettings}
                className="text-xs text-amber-300 hover:text-amber-200 cursor-pointer"
              >
                Configure Custom Engine →
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Action Icons using shadcn Button & Tooltip */}
          <div className="flex items-center space-x-0.5 ml-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onOpenSettings}
                    className="text-neutral-400 hover:text-amber-300 hover:bg-white/[0.06] rounded-lg"
                  />
                }
              >
                <Settings className="w-3.5 h-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings & Telemetry</TooltipContent>
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
        {/* Active Focus Filter Badge (if selected) */}
        {activeCategoryTitle && (
          <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 animate-in fade-in duration-150">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[11px]">
                Active Focus: <strong className="font-semibold text-amber-300">{activeCategoryTitle}</strong>
              </span>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleClearCategory}
              className="h-5 px-1.5 text-[10px] text-amber-300/80 hover:text-amber-100 hover:bg-amber-500/20"
            >
              Reset ✕
            </Button>
          </div>
        )}

        {/* Search & Question Input with shadcn Input & Button */}
        <form
          onSubmit={handleSearchSubmit}
          className="group relative flex items-center bg-[#0c0d12]/95 border border-white/[0.08] hover:border-white/[0.14] focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/30 rounded-2xl px-3.5 py-1.5 shadow-inner transition-all duration-200"
        >
          <Search className="w-4 h-4 text-neutral-400 group-focus-within:text-amber-400 mr-2.5 shrink-0 transition-colors" />

          <Input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="What would you like to know today?"
            className="h-8 border-0 bg-transparent px-0 py-0 text-xs font-medium text-white placeholder:text-neutral-500 focus-visible:ring-0 focus-visible:border-0 shadow-none"
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
                className="text-neutral-400 hover:text-neutral-200 rounded-md"
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
                        ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50 animate-pulse"
                        : "text-neutral-400 hover:text-amber-300 hover:bg-white/[0.08]"
                    }`}
                  />
                }
              >
                {micActive ? <Volume2 className="w-3.5 h-3.5 text-amber-300" /> : <Mic className="w-3.5 h-3.5" />}
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
                    className="text-neutral-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg disabled:opacity-40"
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
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
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

        {/* 4 Categorical Cards using shadcn Card */}
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Card
                key={cat.id}
                onClick={() => handleSelectCategory(cat.id, cat.title, cat.suggestion)}
                className={`p-3 gap-2 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
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
                        ? "bg-amber-500/20 text-amber-300 border-amber-400/30"
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
            Toggle: <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-300 font-mono text-[9px]">Alt+Space</kbd>
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={onCollapse}
            className="h-5 px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1"
          >
            <span>Collapse</span>
            <ChevronUp className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
