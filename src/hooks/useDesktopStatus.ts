import { useState, useEffect, useCallback } from "react";
import { tauriBridge } from "../services/tauriBridge";
import type { SystemInfo, AppStatus, AppError } from "../types/desktop";

export interface DesktopStatusState {
  systemInfo: SystemInfo | null;
  appStatus: AppStatus | null;
  isLoading: boolean;
  error: AppError | null;
  refetch: () => Promise<void>;
}

export function useDesktopStatus(): DesktopStatusState {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sys, app] = await Promise.all([
        tauriBridge.getSystemInfo(),
        tauriBridge.getAppStatus(),
      ]);
      setSystemInfo(sys);
      setAppStatus(app);
    } catch (err) {
      setError(err as AppError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    systemInfo,
    appStatus,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}

