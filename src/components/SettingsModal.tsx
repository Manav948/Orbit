import { useState, type FormEvent } from "react";
import { CloseIcon, SettingsIcon } from "./icons";
import { tauriBridge } from "../services/tauriBridge";
import type { SystemInfo, AppStatus, WindowGeometry } from "../types/desktop";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemInfo: SystemInfo | null;
  appStatus: AppStatus | null;
  windowGeometry: WindowGeometry | null;
}

export function SettingsModal({
  isOpen,
  onClose,
  systemInfo,
  appStatus,
  windowGeometry,
}: SettingsModalProps) {
  const [pingInput, setPingInput] = useState("Nexora Native Diagnostic");
  const [pingResponse, setPingResponse] = useState<string | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  if (!isOpen) return null;

  const handleTestPing = async (e: FormEvent) => {
    e.preventDefault();
    setIsPinging(true);
    setPingError(null);
    setPingResponse(null);
    try {
      const res = await tauriBridge.ping(pingInput);
      setPingResponse(res);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setPingError(String((err as { message: unknown }).message));
      } else {
        setPingError("Diagnostic ping failed");
      }
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-md rounded-2xl animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-xl p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <SettingsIcon className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Nexora Settings & Diagnostics
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Runtime Diagnostics */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Host Environment
            </span>
            <span className="text-slate-200 font-medium mt-0.5 block capitalize">
              {systemInfo?.os ?? "Windows"} ({systemInfo?.arch ?? "x86_64"})
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Tauri Runtime
            </span>
            <span className="text-emerald-400 font-medium mt-0.5 block">
              {systemInfo?.tauri_version ?? "Tauri 2"} &bull; {appStatus?.runtime_mode ?? "Active"}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 col-span-2">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Window Configuration & Geometry
            </span>
            <span className="text-slate-300 font-mono text-[11px] mt-0.5 block">
              Configured: 720 × 560 px (Centered &bull; Frameless &bull; Transparent)
            </span>
            {windowGeometry && (
              <span className="text-sky-400 font-mono text-[10px] mt-0.5 block">
                Live Win32 Rect: {windowGeometry.width} × {windowGeometry.height} px at ({windowGeometry.x}, {windowGeometry.y}) &bull; Scale {windowGeometry.scale_factor}x
              </span>
            )}
          </div>
        </div>

        {/* Native IPC Test Form */}
        <form onSubmit={handleTestPing} className="space-y-2 pt-1 border-t border-slate-800/80">
          <label
            htmlFor="diag-input"
            className="block text-[11px] font-medium text-slate-300"
          >
            Native IPC Diagnostics Test
          </label>
          <div className="flex gap-2">
            <input
              id="diag-input"
              type="text"
              value={pingInput}
              onChange={(e) => setPingInput(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              placeholder="Test payload..."
            />
            <button
              type="submit"
              disabled={isPinging}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isPinging ? "Testing..." : "Test IPC"}
            </button>
          </div>

          {pingResponse && (
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-300">
              {pingResponse}
            </div>
          )}

          {pingError && (
            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
              {pingError}
            </div>
          )}
        </form>

        {/* Footer actions */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
