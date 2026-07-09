import { useQuery } from "@tanstack/react-query";
import { getActiveAssignments } from "../api/assignments";

export function useActiveAssignments() {
  return useQuery({
    queryKey: ["assignments", "active"],
    queryFn: getActiveAssignments,
    staleTime: 45_000,
  });
}