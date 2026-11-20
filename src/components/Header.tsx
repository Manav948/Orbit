import { OrbitLogo, SettingsIcon, CloseIcon } from "./icons";

interface HeaderProps {
  onOpenSettings: () => void;
  onCloseWindow: () => void;
}

export function Header({ onOpenSettings, onCloseWindow }: HeaderProps) {
  return (
    <header
      data-tauri-drag-region
      className="flex items-center justify-between px-5 pt-4 pb-3 select-none cursor-move border-b border-slate-800/60"
    >
      {/* Brand Identity */}
      <div className="flex items-center space-x-2.5 pointer-events-none">
        <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 shadow-sm shadow-sky-500/10">
          <OrbitLogo className="w-4 h-4" />
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-sm tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Orbit
          </span>
          <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Assistant
          </span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-1" data-tauri-drag-region="false">
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings & System Diagnostics"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 active:bg-slate-800 transition-colors cursor-pointer"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onCloseWindow}
          title="Hide Window"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 active:bg-rose-500/20 transition-colors cursor-pointer"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
