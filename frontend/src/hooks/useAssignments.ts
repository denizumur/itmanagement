import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAssignment,
  getActiveAssignments,
  getAssignments,
  returnAssignment,
} from "../api/assignments";
import type {
  AssignmentCreatePayload,
  AssignmentReturnPayload,
} from "../types/assignments";

export function useAssignments() {
  return useQuery({
    queryKey: ["assignments"],
    queryFn: getAssignments,
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
      await queryClient.invalidateQueries();
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
      await queryClient.invalidateQueries();
    },
  });
}