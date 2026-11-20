import { isTauriEnvironment } from "../services/tauriBridge";

export function FooterBar() {
  const isNative = isTauriEnvironment();

  return (
    <footer className="flex items-center justify-between px-5 py-2.5 border-t border-slate-800/60 text-[11px] text-slate-500 select-none">
      <div className="flex items-center space-x-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isNative ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
        <span>
          {isNative ? "Nexora Host Active" : "Web Preview Mode"}
        </span>
      </div>

      <div className="flex items-center space-x-3 text-slate-400">
        <span>Click <kbd className="font-mono text-slate-300">×</kbd> to hide to background</span>
      </div>
    </footer>
  );
}

