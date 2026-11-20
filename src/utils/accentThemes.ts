import type { AccentColor } from "../types/desktop";

export interface AccentThemeConfig {
  id: AccentColor;
  name: string;
  paletteLabel: string;
  dot: string;
  text: string;
  textLight: string;
  bgSubtle: string;
  bgActive: string;
  borderSubtle: string;
  borderActive: string;
  hoverBorder: string;
  glow: string;
  ring: string;
  activeBadge: string;
}

export const ACCENT_THEMES: Record<AccentColor, AccentThemeConfig> = {
  amber: {
    id: "amber",
    name: "Obsidian Gold",
    paletteLabel: "Warm Amber",
    dot: "bg-amber-400",
    text: "text-amber-400",
    textLight: "text-amber-300",
    bgSubtle: "bg-amber-500/10",
    bgActive: "bg-amber-500/20",
    borderSubtle: "border-amber-500/30",
    borderActive: "border-amber-400/40",
    hoverBorder: "hover:border-amber-500/40",
    glow: "shadow-amber-500/20",
    ring: "focus-within:ring-amber-500/30",
    activeBadge: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  },
  cyber: {
    id: "cyber",
    name: "Cyber Blue",
    paletteLabel: "Electric Cyan",
    dot: "bg-sky-400",
    text: "text-sky-400",
    textLight: "text-sky-300",
    bgSubtle: "bg-sky-500/10",
    bgActive: "bg-sky-500/20",
    borderSubtle: "border-sky-500/30",
    borderActive: "border-sky-400/40",
    hoverBorder: "hover:border-sky-500/40",
    glow: "shadow-sky-500/20",
    ring: "focus-within:ring-sky-500/30",
    activeBadge: "bg-sky-500/20 text-sky-300 border-sky-400/30",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Jade",
    paletteLabel: "Vivid Emerald",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    textLight: "text-emerald-300",
    bgSubtle: "bg-emerald-500/10",
    bgActive: "bg-emerald-500/20",
    borderSubtle: "border-emerald-500/30",
    borderActive: "border-emerald-400/40",
    hoverBorder: "hover:border-emerald-500/40",
    glow: "shadow-emerald-500/20",
    ring: "focus-within:ring-emerald-500/30",
    activeBadge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  },
  violet: {
    id: "violet",
    name: "Amethyst Violet",
    paletteLabel: "Deep Violet",
    dot: "bg-violet-400",
    text: "text-violet-400",
    textLight: "text-violet-300",
    bgSubtle: "bg-violet-500/10",
    bgActive: "bg-violet-500/20",
    borderSubtle: "border-violet-500/30",
    borderActive: "border-violet-400/40",
    hoverBorder: "hover:border-violet-500/40",
    glow: "shadow-violet-500/20",
    ring: "focus-within:ring-violet-500/30",
    activeBadge: "bg-violet-500/20 text-violet-300 border-violet-400/30",
  },
};

export function getAccentConfig(color: AccentColor = "amber"): AccentThemeConfig {
  return ACCENT_THEMES[color] ?? ACCENT_THEMES.amber;
}

