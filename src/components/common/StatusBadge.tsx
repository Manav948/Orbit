interface StatusBadgeProps {
  status: "success" | "warning" | "error" | "neutral";
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const styles = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    error: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    neutral: "bg-slate-700/30 text-slate-300 border-slate-700/50",
  }[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current animate-pulse" />
      {label}
    </span>
  );
}

