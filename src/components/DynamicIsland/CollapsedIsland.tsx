import { useState } from "react";
import { Mic, ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { voiceService } from "../../services/voiceService";
import { AnswerContent } from "./AnswerContent";
import type { AiAnswer } from "../../services/dbService";

interface CollapsedIslandProps {
  onExpand: () => void;
  onVoiceQuery: (query: string) => void;
  voiceQuestion: string | null;
  voiceAnswer: AiAnswer | null;
  voiceAnswerLoading: boolean;
  voiceAnswerError: string | null;
  onDismissVoiceAnswer: () => void;
}

export function CollapsedIsland({
  onExpand,
  onVoiceQuery,
  voiceQuestion,
  voiceAnswer,
  voiceAnswerLoading,
  voiceAnswerError,
  onDismissVoiceAnswer,
}: CollapsedIslandProps) {
  const [micPulse, setMicPulse] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const hasVoiceAnswer = voiceQuestion !== null;

  const handleMicClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (micPulse) {
      voiceService.stopListening();
      setMicPulse(false);
      return;
    }

    setMicError(null);
    setMicPulse(true);
    const started = await voiceService.startListening(
      (transcript) => {
        setMicPulse(false);
        onVoiceQuery(transcript);
      },
      (error) => {
        setMicError(error);
        if (error.startsWith("Automatic silence detection is unavailable") || error.startsWith("Automatic stop unavailable:")) {
          return;
        }
        setMicPulse(false);
      },
      () => setMicPulse(false),
      { autoStopAfterSilenceMs: 1800 },
    );
    if (!started) setMicPulse(false);
  };

  return (
    <div
      data-tauri-drag-region
      onClick={onExpand}
      className={`group relative w-[352px] px-3 bg-black/95 hover:bg-[#090a0f]/98 border border-white/[0.08] hover:border-amber-500/40 ${
        hasVoiceAnswer ? "rounded-2xl" : "h-[40px] rounded-full"
      } cursor-pointer backdrop-blur-2xl transition-all duration-300 select-none ring-1 ring-white/[0.03]`}
    >
      <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-amber-500/0 via-amber-500/[0.05] to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="relative flex h-[40px] items-center justify-between" data-tauri-drag-region="false">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-semibold text-xs tracking-tight text-white/90 group-hover:text-white transition-colors pointer-events-none">
            Orbit
          </span>
          {hasVoiceAnswer && (
            <span className="truncate text-[10px] text-neutral-500">
              {voiceAnswerLoading ? "Thinking..." : voiceAnswer ? "Voice answer" : voiceAnswerError ? "Answer unavailable" : "Voice question"}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
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
              <span>{micError || (micPulse ? "Listening... pause to ask Orbit" : "Ask Orbit by voice")}</span>
            </TooltipContent>
          </Tooltip>

          {hasVoiceAnswer ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={(event) => {
                event.stopPropagation();
                onDismissVoiceAnswer();
              }}
              className="rounded-full text-neutral-500 hover:text-white hover:bg-white/[0.08]"
              title="Close answer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="text-neutral-500 group-hover:text-amber-400/90 transition-colors pointer-events-none pl-0.5">
              <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
            </div>
          )}
        </div>
      </div>

      {hasVoiceAnswer && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="relative border-t border-white/[0.07] pb-3 pt-2"
        >
          <div className="mb-1 truncate text-[9px] text-neutral-500" title={voiceQuestion ?? undefined}>
            {voiceQuestion}
          </div>
          <div className="max-h-[130px] overflow-y-auto pr-1 text-[11px] leading-relaxed text-neutral-200">
            {voiceAnswerLoading ? (
              <div className="flex items-center gap-2 py-2 text-neutral-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />
                <span>Checking Orbit's news and current sources...</span>
              </div>
            ) : voiceAnswer ? (
              <AnswerContent content={voiceAnswer.answer} />
            ) : (
              <p className="text-rose-300">{voiceAnswerError || "Orbit couldn't answer that question."}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
