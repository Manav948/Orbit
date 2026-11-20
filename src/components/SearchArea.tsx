import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { SearchIcon, MicrophoneIcon } from "./icons";

interface SearchAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  placeholder?: string;
  activeCategoryTitle?: string | null;
  onClearCategory?: () => void;
}

export function SearchArea({
  value,
  onChange,
  onSubmit,
  placeholder = "What would you like to know today?",
  activeCategoryTitle,
  onClearCategory,
}: SearchAreaProps) {
  const [micActive, setMicActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  const handleMicClick = () => {
    // Visual feedback only for this phase
    setMicActive(true);
    setTimeout(() => setMicActive(false), 1200);
  };

  return (
    <div className="space-y-2">
      {/* Active Category Filter Pill (if selected) */}
      {activeCategoryTitle && (
        <div className="flex items-center justify-between text-xs px-3 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300">
          <span className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span>Category context: <strong className="text-sky-300 font-medium">{activeCategoryTitle}</strong></span>
          </span>
          <button
            type="button"
            onClick={onClearCategory}
            className="text-slate-400 hover:text-slate-200 transition-colors text-[11px] cursor-pointer"
          >
            Clear filter ✕
          </button>
        </div>
      )}

      {/* Main Search Bar */}
      <form
        onSubmit={handleSubmit}
        className="group relative flex items-center bg-slate-900/90 border border-slate-700/60 rounded-xl px-4 py-3.5 shadow-lg shadow-black/20 focus-within:border-sky-500/70 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all duration-200"
      >
        <SearchIcon className="w-4 h-4 text-slate-400 group-focus-within:text-sky-400 mr-3 shrink-0 transition-colors" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm font-medium text-slate-100 placeholder-slate-500 focus:outline-none"
        />

        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
          {/* Clear text button */}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Clear input"
            >
              <span className="text-xs">✕</span>
            </button>
          )}

          {/* Microphone button (Visual only for now) */}
          <button
            type="button"
            onClick={handleMicClick}
            title={micActive ? "Listening (Visual simulation)..." : "Voice input (Coming soon)"}
            className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
              micActive
                ? "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40 animate-pulse"
                : "text-slate-400 hover:text-sky-400 hover:bg-slate-800/80 active:bg-slate-800"
            }`}
          >
            <MicrophoneIcon className="w-4 h-4" />
          </button>

          {/* Enter key badge indicator */}
          <button
            type="submit"
            disabled={!value.trim()}
            className="hidden sm:inline-flex items-center justify-center px-2 py-1 rounded text-[11px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/80 disabled:opacity-40 cursor-pointer hover:bg-slate-700 hover:text-slate-200 transition-colors"
          >
            ↵ Enter
          </button>
        </div>
      </form>
    </div>
  );
}

