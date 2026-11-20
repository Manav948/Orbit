import { useState } from "react";
import { Mic, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface CollapsedIslandProps {
  onExpand: () => void;
}

export function CollapsedIsland({ onExpand }: CollapsedIslandProps) {
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
      className="group relative flex items-center justify-between w-[352px] h-[40px] px-3 bg-black/95 hover:bg-[#090a0f]/98 border border-white/[0.08] hover:border-amber-500/40 rounded-full cursor-pointer backdrop-blur-2xl transition-all duration-300 select-none ring-1 ring-white/[0.03]"
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/0 via-amber-500/[0.05] to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <span className="font-semibold text-xs tracking-tight text-white/90 group-hover:text-white transition-colors pointer-events-none">
        Orbit
      </span>

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
