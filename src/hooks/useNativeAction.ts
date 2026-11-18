import { useState, useCallback } from "react";
import { tauriBridge } from "../services/tauriBridge";
import type { AppError } from "../types/desktop";

export interface NativeActionResult {
  response: string | null;
  isLoading: boolean;
  error: AppError | null;
  executePing: (message: string) => Promise<boolean>;
  reset: () => void;
}

export function useNativeAction(): NativeActionResult {
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);

  const executePing = useCallback(async (message: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await tauriBridge.ping(message);
      setResponse(res);
      return true;
    } catch (err) {
      setError(err as AppError);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResponse(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    response,
    isLoading,
    error,
    executePing,
    reset,
  };
}

