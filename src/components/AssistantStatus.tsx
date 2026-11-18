import { Card } from "./common/Card";
import type { SystemInfo, AppStatus } from "../types/desktop";

interface AssistantStatusProps {
  systemInfo: SystemInfo | null;
  appStatus: AppStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export function AssistantStatus({
  systemInfo,
  appStatus,
  isLoading,
  onRefresh,
}: AssistantStatusProps) {
  return (
    <Card
      title="Host & System Architecture"
      subtitle="Native diagnostics reported by Rust desktop core"
      action={
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
            Operating System
          </span>
          <span className="text-sm font-medium text-slate-100 mt-1 block capitalize">
            {systemInfo?.os ?? "Detecting..."}
          </span>
        </div>

        <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
            Architecture
          </span>
          <span className="text-sm font-medium text-slate-100 mt-1 block">
            {systemInfo?.arch ?? "Detecting..."}
          </span>
        </div>

        <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
            Tauri Version
          </span>
          <span className="text-sm font-medium text-slate-100 mt-1 block">
            {systemInfo?.tauri_version ?? "Tauri 2"}
          </span>
        </div>

        <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
            Runtime Environment
          </span>
          <span className="text-sm font-medium text-emerald-400 mt-1 block">
            {appStatus?.runtime_mode ?? "Active"}
          </span>
        </div>
      </div>
    </Card>
  );
}

