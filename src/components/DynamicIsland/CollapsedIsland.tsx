import { useState } from "react";
import { NexoraLogo, MicrophoneIcon, ChevronDownIcon } from "../icons";

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
    setTimeout(() => setMicPulse(false), 900);
  };

  return (
    <div
      data-tauri-drag-region
      onClick={onExpand}
      title="Click to expand Nexora Intelligence Island"
      className="group relative flex items-center justify-between w-[348px] h-[40px] px-3.5 bg-black/95 hover:bg-[#0b0c10]/98 border border-white/[0.09] hover:border-amber-500/40 rounded-full shadow-2xl shadow-black/95 cursor-pointer backdrop-blur-2xl transition-all duration-300 select-none"
    >
      {/* Subtle Ambient Amber Glow on hover */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/0 via-amber-500/[0.04] to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Left: Nexora Emblem & Brand Name */}
      <div className="flex items-center space-x-2 pointer-events-none">
        <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform duration-200">
          <NexoraLogo className="w-3 h-3" />
        </div>
        <span className="font-semibold text-xs tracking-tight text-neutral-200 group-hover:text-white transition-colors">
          Nexora
        </span>
      </div>

      {/* Center: Intelligence / Status Indicator */}
      <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.05] pointer-events-none">
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
        <span className="text-[10px] font-medium tracking-wide text-neutral-400 group-hover:text-neutral-300 transition-colors">
          {statusText}
        </span>
      </div>

      {/* Right: Quick Mic & Expand Chevron */}
      <div className="flex items-center space-x-1" data-tauri-drag-region="false">
        <button
          type="button"
          onClick={handleMicClick}
          title={micPulse ? "Listening..." : "Quick Voice Query"}
          className={`p-1 rounded-full transition-all duration-200 cursor-pointer ${
            micPulse
              ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50 scale-110"
              : "text-neutral-400 hover:text-amber-300 hover:bg-white/[0.06]"
          }`}
        >
          <MicrophoneIcon className="w-3.5 h-3.5" />
        </button>

        <div className="text-neutral-500 group-hover:text-amber-400/80 transition-colors pointer-events-none pl-0.5">
          <ChevronDownIcon className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
}

