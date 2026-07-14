import { useCallback, useEffect, useState } from "react";
import { fetchNotificationCenter } from "../api/notifications";
import type { NotificationCenterResponse } from "../types/notifications";

const CRITICAL_POLL_INTERVAL_MS = 30 * 60 * 1000;

export function useNotificationCenter() {
  const [data, setData] = useState<NotificationCenterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const refetch = useCallback(async () => {
    try {
      setIsError(false);
      const response = await fetchNotificationCenter();
      setData(response);
      setLastCheckedAt(new Date());
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();

    const interval = window.setInterval(() => {
      refetch();
    }, CRITICAL_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [refetch]);

  return {
    data,
    isLoading,
    isError,
    lastCheckedAt,
    refetch,
  };
}