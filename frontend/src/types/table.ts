export interface TableQueryState {
  page: number;
  pageSize: number;
  ordering: string | null;
  search: string;
  filters: Record<string, string | string[]>;
}

export interface TableQueryDefaults {
  page?: number;
  pageSize?: number;
  ordering?: string | null;
  search?: string;
}

export type SortDirection = "asc" | "desc" | null;