"use client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type WaveformState = "idle" | "listening" | "recording" | "speaking";

export type VoiceWaveformProps = {
  state?: WaveformState;
  bars?: number;
  className?: string;
};

/* Bars animate with the same keyframe; the state picks the speed,
   opacity and color (color comes from the parent via currentColor). */

const DURATION: Record<WaveformState, number> = {
  idle: 0,
  listening: 1.1,
  recording: 0.8,
  speaking: 0.55,
};

const OPACITY: Record<WaveformState, number> = {
  idle: 0.5,
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
  className = "",
}: VoiceWaveformProps) {
  const dur = DURATION[state];
  const opacity = OPACITY[state];

  return (
    <>
      <style>{`@keyframes aiui-wave{0%,100%{transform:scaleY(.25)}50%{transform:scaleY(1)}} @media(prefers-reduced-motion:reduce){.scrim-wave-bar{animation:none!important}}`}</style>
      <div className={`flex h-8 items-center gap-[2px] ${className}`} aria-hidden>
        {Array.from({ length: bars }).map((_, i) => {
          /* A varied, symmetric envelope keeps the idle waveform visible. */
          const t = i / Math.max(bars - 1, 1);
          /* Rounded, not raw: a full-precision float lands in the SSR HTML as
             scaleY(0.6943240406445356), and the browser hands it back to
             hydration as scaleY(0.694324) — a mismatch React reports as an
             error. Three decimals is well below a visible difference. */
          const envelope = 0.25 + 0.75 * Math.sin(Math.PI * t);
          const variation = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 12.9898) * Math.cos((i + 1) * 4.1414));
          const base = Number((envelope * variation).toFixed(3));
          return (
            <span
              key={i}
              className="scrim-wave-bar w-[2px] rounded-full bg-current"
              style={{
                height: "100%",
                transform: `scaleY(${base})`,
                transformOrigin: "center",
                animation: dur
                  ? `aiui-wave ${dur}s ease-in-out ${i * (dur / bars)}s infinite`
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
