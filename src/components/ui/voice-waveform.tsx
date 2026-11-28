"use client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type WaveformState = "idle" | "listening" | "recording" | "speaking";

export type VoiceWaveformProps = {
  state?: WaveformState;
  bars?: number;
  height?: number;
  className?: string;
};

const DURATION: Record<WaveformState, number> = {
  idle: 0,
  listening: 1.1,
  recording: 0.8,
  speaking: 0.45,
};

const OPACITY: Record<WaveformState, number> = {
  idle: 0.72,
  listening: 0.7,
  recording: 1,
  speaking: 1,
};

/* ------------------------------------------------------------------ */
/* VoiceWaveform                                                       */
/* ------------------------------------------------------------------ */

export function VoiceWaveform({
  state = "idle",
  bars = 24,
  height = 32,
  className = "",
}: VoiceWaveformProps) {
  const dur = DURATION[state];
  const opacity = OPACITY[state];

  return (
    <>
      <style>{`@keyframes orbit-voice-wave{0%,100%{transform:scaleY(.28)}50%{transform:scaleY(1.08)}} @media(prefers-reduced-motion:reduce){.orbit-voice-wave-bar{animation:none!important}}`}</style>
      <div
        className={`flex items-start gap-[2px] ${className}`}
        style={{ height }}
        aria-hidden
      >
        {Array.from({ length: bars }).map((_, i) => {
          const t = i / Math.max(bars - 1, 1);
          const envelope = 0.3 + 0.7 * Math.abs(Math.sin(Math.PI * (2.5 * t + 0.12)));
          const variation = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 12.9898) * Math.cos((i + 1) * 4.1414));
          const level = Number((0.12 + 0.88 * envelope * variation).toFixed(3));
          return (
            <span
              key={i}
              className="orbit-voice-wave-bar w-[2px] shrink-0 rounded-full bg-current"
              style={{
                height: `${level * 100}%`,
                transformOrigin: "top",
                animation: dur
                  ? `orbit-voice-wave ${dur}s ease-in-out ${i * (dur / bars)}s infinite`
                  : "none",
                opacity,
              }}
            />
          );
        })}
      </div>
    </>
  );
}
