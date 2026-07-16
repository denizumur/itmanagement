import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createAssignment,
  getActiveAssignments,
  getAssignments,
  getAssignmentSummary,
  getAssignmentsTable,
  returnAssignment,
} from "../api/assignments";
import type {
  AssignmentCreatePayload,
  AssignmentReturnPayload,
} from "../types/assignments";
import type { TableQueryState } from "../types/table";

export function useAssignments() {
  return useQuery({
    queryKey: ["assignments"],
    queryFn: getAssignments,
    staleTime: 45_000,
  });
}

export function useAssignmentsTable(state: TableQueryState) {
  return useQuery({
    queryKey: ["assignments", "table", state],
    queryFn: () => getAssignmentsTable(state),
    placeholderData: keepPreviousData,
    staleTime: 45_000,
  });
}

export function useAssignmentSummary() {
  return useQuery({
    queryKey: ["assignments", "summary"],
    queryFn: getAssignmentSummary,
    staleTime: 45_000,
  });
}

export function useActiveAssignments() {
  return useQuery({
    queryKey: ["assignments", "active"],
    queryFn: getActiveAssignments,
    staleTime: 45_000,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AssignmentCreatePayload) => createAssignment(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assignments"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useReturnAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload?: AssignmentReturnPayload;
    }) => returnAssignment(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assignments"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}