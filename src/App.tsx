import { Header } from "./components/Header";
import { AssistantStatus } from "./components/AssistantStatus";
import { NativeActionPanel } from "./components/NativeActionPanel";
import { useDesktopStatus } from "./hooks/useDesktopStatus";
import { useNativeAction } from "./hooks/useNativeAction";

export function App() {
  const { systemInfo, appStatus, isLoading: statusLoading, error: statusError, refetch } =
    useDesktopStatus();
  const {
    response,
    isLoading: actionLoading,
    error: actionError,
    executePing,
    reset,
  } = useNativeAction();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        appVersion={systemInfo?.app_version ?? "0.1.0"}
        isOnline={!statusError}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {statusError && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
            <div>
              <span className="font-semibold block text-amber-200">Host Communication Notice</span>
              <p>{statusError.message}</p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded text-xs transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        <AssistantStatus
          systemInfo={systemInfo}
          appStatus={appStatus}
          isLoading={statusLoading}
          onRefresh={refetch}
        />

        <NativeActionPanel
          isLoading={actionLoading}
          response={response}
          error={actionError}
          onSendPing={executePing}
          onReset={reset}
        />
      </main>

      <footer className="border-t border-slate-900 py-3 px-6 text-center text-xs text-slate-400">
        Desktop Intelligence Assistant &bull; Lightweight Tauri 2 Architecture
      </footer>
    </div>
  );
}

export default App;
