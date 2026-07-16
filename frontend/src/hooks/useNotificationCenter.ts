import { useQuery } from "@tanstack/react-query";
import { fetchNotificationCenter } from "../api/notifications";

export function useNotificationCenter() {
  return useQuery({
    queryKey: ["notifications", "center"],
    queryFn: fetchNotificationCenter,
    refetchInterval: (query) => {
      const intervalSeconds =
        query.state.data?.polling.interval_seconds ??
        query.state.data?.polling.critical_interval_seconds ??
        1800;

      return intervalSeconds * 1000;
    },
    staleTime: 60_000,
  });
}