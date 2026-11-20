import type { ReactNode } from "react";

interface CategoryCardProps {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  icon: ReactNode;
  isSelected?: boolean;
  accentStyles: {
    bgGradient: string;
    borderGlow: string;
    iconColor: string;
    tagStyle: string;
  };
  onClick: (id: string, title: string) => void;
}

export function CategoryCard({
  id,
  title,
  subtitle,
  tag,
  icon,
  isSelected,
  accentStyles,
  onClick,
}: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(id, title)}
      className={`group relative text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${
        isSelected
          ? `bg-slate-900 border-sky-500/60 ring-1 ring-sky-500/30 shadow-md ${accentStyles.borderGlow}`
          : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700/80 hover:-translate-y-0.5"
      }`}
    >
      {/* Subtle background ambient gradient on hover */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br ${accentStyles.bgGradient}`}
      />

      <div className="relative z-10 flex items-start justify-between">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center p-1.5 transition-colors ${accentStyles.iconColor}`}
        >
          {icon}
        </div>

        <span
          className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full border ${accentStyles.tagStyle}`}
        >
          {tag}
        </span>
      </div>

      <div className="relative z-10 mt-3 space-y-1">
        <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
          {title}
        </h3>
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Selected Indicator Pill */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-sky-400 animate-ping" />
      )}
    </button>
  );
}

