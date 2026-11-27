import { useState } from "react";
import { Mic, ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { OrbitLogo } from "../icons";
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
      className={`group relative w-[280px] px-3 bg-background hover:bg-muted border border-border hover:border-foreground/30 ${
        hasVoiceAnswer ? "rounded-[8px]" : "h-[40px] rounded-full"
      } cursor-pointer transition-colors duration-150 select-none`}
    >
      <div className="relative flex h-[40px] items-center justify-between" data-tauri-drag-region="false">
        <div className="flex min-w-0 items-center gap-2">
          <OrbitLogo className="h-[17px] w-[17px] shrink-0 text-foreground" />
          <span className="font-semibold text-xs tracking-tight text-foreground pointer-events-none">Orbit</span>
          {hasVoiceAnswer && (
            <span className="truncate text-[10px] text-muted-foreground">
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
                      ? "bg-secondary text-secondary-foreground ring-1 ring-ring"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                />
              }
            >
              <Mic className={`w-3.5 h-3.5 ${micPulse ? "orbit-accent-icon" : ""}`} />
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
              className="rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
              title="Close answer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="text-muted-foreground group-hover:text-foreground transition-colors pointer-events-none pl-0.5">
              <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
            </div>
          )}
        </div>
      </div>

      {hasVoiceAnswer && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="relative border-t border-border pb-3 pt-2"
        >
          <div className="mb-1 truncate text-[9px] text-muted-foreground" title={voiceQuestion ?? undefined}>
            {voiceQuestion}
          </div>
          <div className="max-h-[130px] overflow-y-auto pr-1 text-[11px] leading-relaxed text-foreground">
            {voiceAnswerLoading ? (
              <div className="flex items-center gap-2 py-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />
                <span>Checking current sources...</span>
              </div>
            ) : voiceAnswer ? (
              <AnswerContent content={voiceAnswer.answer} />
            ) : (
              <p className="text-muted-foreground">{voiceAnswerError || "Orbit couldn't answer that question."}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
