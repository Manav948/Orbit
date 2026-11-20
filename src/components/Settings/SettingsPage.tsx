import { useState, type FormEvent } from "react";
import {
  Sliders,
  Palette,
  Keyboard,
  Sparkles,
  Cpu,
  Info,
  ArrowLeft,
  X,
} from "lucide-react";
import { NexoraLogo } from "../icons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { tauriBridge } from "../../services/tauriBridge";
import type { SystemInfo, AppStatus, WindowGeometry } from "../../types/desktop";

interface SettingsPageProps {
  onBackToIsland: () => void;
  systemInfo: SystemInfo | null;
  appStatus: AppStatus | null;
  windowGeometry: WindowGeometry | null;
}

type SettingsTab =
  | "general"
  | "appearance"
  | "shortcuts"
  | "categories"
  | "ai"
  | "about";

export function SettingsPage({
  onBackToIsland,
  systemInfo,
  appStatus,
  windowGeometry,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  // General Settings State
  const [launchAtStartup, setLaunchAtStartup] = useState(true);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [audioFeedback, setAudioFeedback] = useState(false);

  // Appearance Settings State
  const [accentTheme, setAccentTheme] = useState<"amber" | "cyber" | "emerald">("amber");
  const [glassBlur, setGlassBlur] = useState("strong");
  const [islandScale, setIslandScale] = useState(100);

  // Shortcuts State
  const [globalShortcut] = useState("Alt + Space");
  const [voiceHotkey] = useState("Alt + V");

  // Categories Toggles
  const [feedWorldNews, setFeedWorldNews] = useState(true);
  const [feedFinance, setFeedFinance] = useState(true);
  const [feedTech, setFeedTech] = useState(true);
  const [feedDaily, setFeedDaily] = useState(true);

  // AI Configuration State
  const [aiProvider, setAiProvider] = useState<"local" | "cloud">("cloud");
  const [aiModel, setAiModel] = useState("Nexora Frontier Neural Core (v0.1)");
  const [temperature, setTemperature] = useState(0.4);

  // Diagnostics Ping State
  const [pingInput, setPingInput] = useState("Nexora Native Diagnostic");
  const [pingResponse, setPingResponse] = useState<string | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);

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

  const navItems = [
    { id: "general" as SettingsTab, label: "General", icon: <Sliders className="w-4 h-4" /> },
    { id: "appearance" as SettingsTab, label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "shortcuts" as SettingsTab, label: "Shortcuts", icon: <Keyboard className="w-4 h-4" /> },
    { id: "categories" as SettingsTab, label: "Intelligence Categories", icon: <Sparkles className="w-4 h-4" /> },
    { id: "ai" as SettingsTab, label: "AI Configuration", icon: <Cpu className="w-4 h-4" /> },
    { id: "about" as SettingsTab, label: "About Nexora", icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <Card
      onClick={(e) => e.stopPropagation()}
      className="w-[760px] h-[540px] p-0 gap-0 flex flex-col bg-[#07080a]/98 border-white/[0.09] rounded-3xl shadow-2xl shadow-black/95 overflow-hidden backdrop-blur-2xl text-neutral-200 select-none ring-1 ring-white/[0.04]"
    >
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent cursor-move"
      >
        <div className="flex items-center space-x-3" data-tauri-drag-region="false">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToIsland}
            className="h-7 px-2.5 bg-white/[0.04] hover:bg-amber-500/10 border-white/[0.08] hover:border-amber-500/30 text-xs text-neutral-200 hover:text-amber-300 gap-1.5 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Island View</span>
          </Button>

          <Separator orientation="vertical" className="h-4 bg-white/[0.1]" />

          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <NexoraLogo className="w-3 h-3" />
            </div>
            <h1 className="text-xs font-semibold text-white tracking-tight">
              Nexora Preferences
            </h1>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onBackToIsland}
          className="text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-lg"
          title="Close Settings (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* ── Two-Column Layout ──────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar Navigation */}
        <div className="w-56 p-3 border-r border-white/[0.06] bg-black/30 flex flex-col justify-between">
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <Button
                  key={item.id}
                  variant={active ? "secondary" : "ghost"}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full justify-start gap-2.5 h-8 px-3 text-xs font-medium rounded-xl transition-all ${
                    active
                      ? "bg-amber-500/[0.12] text-amber-300 border border-amber-500/30 font-semibold shadow-xs"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
                  }`}
                >
                  <span className={active ? "text-amber-400" : "text-neutral-500"}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Button>
              );
            })}
          </div>

          {/* Quick Telemetry Footnote */}
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[10px] text-neutral-500 space-y-0.5">
            <div className="font-medium text-neutral-400">Nexora Core v0.1.0</div>
            <div>Windows Native • Top-Center</div>
          </div>
        </div>

        {/* Content Pane with shadcn ScrollArea */}
        <ScrollArea className="flex-1 p-5">
          {/* 1. GENERAL TAB */}
          {activeTab === "general" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">General Preferences</h2>
                <p className="text-[11px] text-neutral-400">
                  Control startup behavior, taskbar visibility and system integration.
                </p>
              </div>

              <div className="space-y-2.5">
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex-row items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-white block">Launch at Windows Startup</span>
                    <span className="text-[10px] text-neutral-400 block">
                      Position Nexora Dynamic Island automatically when signing in.
                    </span>
                  </div>
                  <Switch
                    checked={launchAtStartup}
                    onCheckedChange={(checked) => setLaunchAtStartup(checked)}
                  />
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex-row items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-white block">Keep Active in System Tray</span>
                    <span className="text-[10px] text-neutral-400 block">
                      Closing the window hides it to the tray rather than terminating.
                    </span>
                  </div>
                  <Switch
                    checked={minimizeToTray}
                    onCheckedChange={(checked) => setMinimizeToTray(checked)}
                  />
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex-row items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-white block">Audio Confirmation Feedback</span>
                    <span className="text-[10px] text-neutral-400 block">
                      Subtle tactile sound on expansion and query submission.
                    </span>
                  </div>
                  <Switch
                    checked={audioFeedback}
                    onCheckedChange={(checked) => setAudioFeedback(checked)}
                  />
                </Card>
              </div>
            </div>
          )}

          {/* 2. APPEARANCE TAB */}
          {activeTab === "appearance" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">Appearance & Theming</h2>
                <p className="text-[11px] text-neutral-400">
                  Refine the look, accent palette, and floating island styling.
                </p>
              </div>

              {/* Accent Palette */}
              <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2">
                <span className="text-xs font-medium text-white block">Accent Palette</span>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={accentTheme === "amber" ? "secondary" : "outline"}
                    onClick={() => setAccentTheme("amber")}
                    className={`h-9 justify-start px-3 text-xs gap-2 rounded-xl cursor-pointer ${
                      accentTheme === "amber"
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-semibold"
                        : "bg-black/30 border-white/[0.06] text-neutral-400"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span>Obsidian Gold</span>
                  </Button>

                  <Button
                    type="button"
                    variant={accentTheme === "cyber" ? "secondary" : "outline"}
                    onClick={() => setAccentTheme("cyber")}
                    className={`h-9 justify-start px-3 text-xs gap-2 rounded-xl cursor-pointer ${
                      accentTheme === "cyber"
                        ? "bg-sky-500/10 border-sky-500/40 text-sky-300 font-semibold"
                        : "bg-black/30 border-white/[0.06] text-neutral-400"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    <span>Cyber Blue</span>
                  </Button>

                  <Button
                    type="button"
                    variant={accentTheme === "emerald" ? "secondary" : "outline"}
                    onClick={() => setAccentTheme("emerald")}
                    className={`h-9 justify-start px-3 text-xs gap-2 rounded-xl cursor-pointer ${
                      accentTheme === "emerald"
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold"
                        : "bg-black/30 border-white/[0.06] text-neutral-400"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>Emerald Jade</span>
                  </Button>
                </div>
              </Card>

              {/* Island Placement & Controls */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-1">
                  <span className="text-xs font-medium text-white block">Screen Placement</span>
                  <span className="text-[11px] text-amber-300 block font-mono">
                    Top-Center (Dynamic Island)
                  </span>
                  <span className="text-[10px] text-neutral-500 block">
                    Anchored at 12px from top screen edge.
                  </span>
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-1">
                  <span className="text-xs font-medium text-white block">Glass Blur Intensity</span>
                  <select
                    value={glassBlur}
                    onChange={(e) => setGlassBlur(e.target.value)}
                    className="w-full text-xs bg-black/60 border border-white/[0.08] rounded-lg p-1.5 text-neutral-200 focus:outline-none"
                  >
                    <option value="light">Subtle Blur</option>
                    <option value="medium">Medium Acrylic</option>
                    <option value="strong">Deep Obsidian Mica</option>
                  </select>
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-1.5 col-span-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-white">Dynamic Island Compact Scale:</span>
                    <span className="text-amber-300 font-mono">{islandScale}%</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="120"
                    step="5"
                    value={islandScale}
                    onChange={(e) => setIslandScale(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </Card>
              </div>
            </div>
          )}

          {/* 3. SHORTCUTS TAB */}
          {activeTab === "shortcuts" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts</h2>
                <p className="text-[11px] text-neutral-400">
                  Global hotkeys registered natively via Tauri 2.
                </p>
              </div>

              <div className="space-y-2.5">
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex-row items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-white block">Toggle Island Visibility</span>
                    <span className="text-[10px] text-neutral-400 block">
                      Show or hide Nexora from anywhere in Windows.
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="px-2.5 py-1 bg-white/[0.06] border-white/[0.1] text-xs font-mono font-semibold text-amber-300"
                  >
                    {globalShortcut}
                  </Badge>
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex-row items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-white block">Collapse to Island Pill</span>
                    <span className="text-[10px] text-neutral-400 block">
                      Instantly minimize the expanded panel.
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="px-2.5 py-1 bg-white/[0.06] border-white/[0.1] text-xs font-mono font-semibold text-neutral-300"
                  >
                    Escape
                  </Badge>
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex-row items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-white block">Quick Voice Dictation</span>
                    <span className="text-[10px] text-neutral-400 block">
                      Direct voice trigger placeholder.
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="px-2.5 py-1 bg-white/[0.06] border-white/[0.1] text-xs font-mono font-semibold text-neutral-300"
                  >
                    {voiceHotkey}
                  </Badge>
                </Card>
              </div>
            </div>
          )}

          {/* 4. INTELLIGENCE CATEGORIES TAB */}
          {activeTab === "categories" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">Intelligence Feeds</h2>
                <p className="text-[11px] text-neutral-400">
                  Select which intelligence streams populate the Dynamic Island.
                </p>
              </div>

              <div className="space-y-2.5">
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex-row items-center justify-between">
                  <span className="text-xs font-medium text-white">World News & Diplomacy</span>
                  <Switch
                    checked={feedWorldNews}
                    onCheckedChange={(checked) => setFeedWorldNews(checked)}
                  />
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex-row items-center justify-between">
                  <span className="text-xs font-medium text-white">Finance & Markets</span>
                  <Switch
                    checked={feedFinance}
                    onCheckedChange={(checked) => setFeedFinance(checked)}
                  />
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex-row items-center justify-between">
                  <span className="text-xs font-medium text-white">Technology & Artificial Intelligence</span>
                  <Switch
                    checked={feedTech}
                    onCheckedChange={(checked) => setFeedTech(checked)}
                  />
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl flex-row items-center justify-between">
                  <span className="text-xs font-medium text-white">Daily Knowledge & Mental Models</span>
                  <Switch
                    checked={feedDaily}
                    onCheckedChange={(checked) => setFeedDaily(checked)}
                  />
                </Card>
              </div>
            </div>
          )}

          {/* 5. AI CONFIGURATION TAB */}
          {activeTab === "ai" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">AI Configuration</h2>
                <p className="text-[11px] text-neutral-400">
                  Model engine routing and synthesis parameters.
                </p>
              </div>

              <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-white block">Execution Mode</span>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant={aiProvider === "cloud" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setAiProvider("cloud")}
                      className={`h-7 text-xs rounded-xl ${
                        aiProvider === "cloud"
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-medium"
                          : "bg-black/30 border-white/[0.06] text-neutral-400"
                      }`}
                    >
                      Cloud Fast Synthesis
                    </Button>
                    <Button
                      type="button"
                      variant={aiProvider === "local" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setAiProvider("local")}
                      className={`h-7 text-xs rounded-xl ${
                        aiProvider === "local"
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-medium"
                          : "bg-black/30 border-white/[0.06] text-neutral-400"
                      }`}
                    >
                      Local Device Isolation (Placeholder)
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-white block">Active Model Engine</span>
                  <Input
                    type="text"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="h-8 text-xs bg-black/50 border-white/[0.08] rounded-xl text-neutral-200"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-white">Temperature (Creativity):</span>
                    <span className="text-amber-300 font-mono">{temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </Card>
            </div>
          )}

          {/* 6. ABOUT NEXORA TAB */}
          {activeTab === "about" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <h2 className="text-sm font-semibold text-white">About Nexora</h2>
                <p className="text-[11px] text-neutral-400">
                  Application architecture and native Win32 runtime telemetry.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 block">Host OS & Architecture</span>
                  <span className="text-white font-medium mt-0.5 block capitalize">
                    {systemInfo?.os ?? "Windows"} ({systemInfo?.arch ?? "x86_64"})
                  </span>
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 block">Tauri Desktop Runtime</span>
                  <span className="text-amber-300 font-medium mt-0.5 block">
                    {systemInfo?.tauri_version ?? "Tauri 2"} • {appStatus?.runtime_mode ?? "Active"}
                  </span>
                </Card>

                <Card className="p-3 bg-white/[0.02] border-white/[0.06] rounded-2xl col-span-2">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 block">Window Configuration</span>
                  <span className="text-neutral-300 text-[11px] mt-0.5 block">
                    Mode: Dynamic Island • Top-Center • Borderless • Transparent • Always-on-Top
                  </span>
                  {windowGeometry && (
                    <span className="text-amber-300/80 font-mono text-[10px] mt-0.5 block">
                      Live Rect: {windowGeometry.width} × {windowGeometry.height} px at ({windowGeometry.x}, {windowGeometry.y}) • Scale {windowGeometry.scale_factor}x
                    </span>
                  )}
                </Card>
              </div>

              {/* Native Host Diagnostic Ping using shadcn Input & Button */}
              <Card className="p-3.5 bg-white/[0.02] border-white/[0.06] rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-white block">Native Host Ping Diagnostics</span>
                <form onSubmit={handleTestPing} className="flex space-x-2">
                  <Input
                    type="text"
                    value={pingInput}
                    onChange={(e) => setPingInput(e.target.value)}
                    className="h-8 text-xs bg-black/60 border-white/[0.08] rounded-xl text-neutral-200"
                  />
                  <Button
                    type="submit"
                    disabled={isPinging}
                    size="sm"
                    className="h-8 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium cursor-pointer transition-colors"
                  >
                    {isPinging ? "Testing..." : "Send Ping"}
                  </Button>
                </form>

                {pingResponse && (
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-mono">
                    ✓ {pingResponse}
                  </div>
                )}
                {pingError && (
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 font-mono">
                    ✕ {pingError}
                  </div>
                )}
              </Card>
            </div>
          )}
        </ScrollArea>
      </div>
    </Card>
  );
}
