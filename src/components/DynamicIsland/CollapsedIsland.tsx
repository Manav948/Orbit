import { useState } from "react";
import { Mic, ChevronDown, Sparkles } from "lucide-react";
import { NexoraLogo } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface CollapsedIslandProps {
  onExpand: () => void;
  statusText?: string;
  isOnline?: boolean;
}

export function CollapsedIsland({
  onExpand,
  statusText = "Ready",
  isOnline = true,
}: CollapsedIslandProps) {
  const [micPulse, setMicPulse] = useState(false);

  const handleMicClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMicPulse(true);
    setTimeout(() => setMicPulse(false), 1000);
  };

  return (
    <div
      data-tauri-drag-region
      onClick={onExpand}
      className="group relative flex items-center justify-between w-[352px] h-[40px] px-3 bg-black/95 hover:bg-[#090a0f]/98 border border-white/[0.08] hover:border-amber-500/40 rounded-full shadow-2xl shadow-black/95 cursor-pointer backdrop-blur-2xl transition-all duration-300 select-none ring-1 ring-white/[0.03]"
    >
      {/* Subtle Ambient Amber Glow on hover */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/0 via-amber-500/[0.05] to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Left: Nexora Logo & Name */}
      <div className="flex items-center space-x-2 pointer-events-none">
        <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform duration-200">
          <NexoraLogo className="w-3 h-3" />
        </div>
        <span className="font-semibold text-xs tracking-tight text-white/90 group-hover:text-white transition-colors">
          Nexora
        </span>
      </div>

      {/* Center: Intelligence Status using shadcn Badge */}
      <div className="pointer-events-none flex items-center">
        <Badge
          variant="outline"
          className="h-5 px-2 py-0 bg-white/[0.03] border-white/[0.07] text-[10px] font-medium text-neutral-300 gap-1.5 rounded-full"
        >
          <span className="relative flex h-1.5 w-1.5">
            {isOnline && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                isOnline ? "bg-amber-400" : "bg-neutral-500"
              }`}
            />
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-amber-400/80" />
            {statusText}
          </span>
        </Badge>
      </div>

      {/* Right: Quick Voice & Expand Actions using shadcn Button & Tooltip */}
      <div className="flex items-center space-x-1" data-tauri-drag-region="false">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleMicClick}
                className={`rounded-full transition-all duration-200 ${
                  micPulse
                    ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50 scale-110"
                    : "text-neutral-400 hover:text-amber-300 hover:bg-white/[0.08]"
                }`}
              />
            }
          >
            <Mic className="w-3.5 h-3.5" />
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            <span>{micPulse ? "Voice active..." : "Quick voice dictation"}</span>
          </TooltipContent>
        </Tooltip>

        <div className="text-neutral-500 group-hover:text-amber-400/90 transition-colors pointer-events-none pl-0.5">
          <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
}
