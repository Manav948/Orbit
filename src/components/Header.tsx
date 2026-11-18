import { StatusBadge } from "./common/StatusBadge";
import { isTauriEnvironment } from "../services/tauriBridge";

interface HeaderProps {
  appVersion?: string;
  isOnline: boolean;
}

export function Header({ appVersion = "0.1.0", isOnline }: HeaderProps) {
  const isNative = isTauriEnvironment();

  return (
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10 px-6 py-4">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold text-lg">
            DIA
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">
                Desktop Intelligence Assistant
              </h1>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                v{appVersion}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Windows Native Host &bull; Tauri 2 &bull; React &bull; Rust
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <StatusBadge
            status={isNative ? "success" : "neutral"}
            label={isNative ? "Native Desktop Host" : "Web Preview Host"}
          />
          <StatusBadge
            status={isOnline ? "success" : "warning"}
            label={isOnline ? "Online" : "Connecting"}
          />
        </div>
      </div>
    </header>
  );
}

