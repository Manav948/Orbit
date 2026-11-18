import { useState, type FormEvent } from "react";
import { Card } from "./common/Card";
import type { AppError } from "../types/desktop";

interface NativeActionPanelProps {
  isLoading: boolean;
  response: string | null;
  error: AppError | null;
  onSendPing: (message: string) => Promise<boolean>;
  onReset: () => void;
}

export function NativeActionPanel({
  isLoading,
  response,
  error,
  onSendPing,
  onReset,
}: NativeActionPanelProps) {
  const [message, setMessage] = useState("Hello from Desktop UI");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSendPing(message);
  };

  return (
    <Card
      title="Native Desktop IPC Communication"
      subtitle="Safely invoke Rust backend commands with structured error handling"
      action={
        (response || error) && (
          <button
            onClick={onReset}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Clear Log
          </button>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="ipc-input"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Payload Message to Native Host
          </label>
          <div className="flex gap-2">
            <input
              id="ipc-input"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message to invoke native Rust handler..."
              className="flex-1 px-3.5 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors cursor-pointer shadow-sm shadow-sky-950"
            >
              {isLoading ? "Dispatching..." : "Send IPC"}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Tip: Sending an empty input tests the backend validation and error handling pipeline.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start space-x-2.5">
            <span className="font-bold text-rose-400">Error:</span>
            <div className="flex-1 space-y-0.5">
              <p>{error.message}</p>
              <span className="text-[10px] text-rose-400/80 font-mono block">
                {error.timestamp}
              </span>
            </div>
          </div>
        )}

        {response && (
          <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start space-x-2.5">
            <span className="font-bold text-emerald-400">Response:</span>
            <p className="flex-1 font-mono">{response}</p>
          </div>
        )}
      </form>
    </Card>
  );
}

