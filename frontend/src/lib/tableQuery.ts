import type { TableQueryState, SortDirection } from "../types/table";

export function buildTableApiParams(state: TableQueryState) {
  const params: Record<string, string | number | string[]> = {
    page: state.page,
    page_size: state.pageSize,
  };

  if (state.search.trim()) {
    params.search = state.search.trim();
  }

  if (state.ordering) {
    params.ordering = state.ordering;
  }

  Object.entries(state.filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params[key] = value;
      }

      return;
    }

    if (value !== "") {
      params[key] = value;
    }
  });

  return params;
}

export function getSortDirection(
  ordering: string | null,
  field: string
): SortDirection {
  if (ordering === field) {
    return "asc";
  }

  if (ordering === `-${field}`) {
    return "desc";
  }

  return null;
}

export function getNextOrdering(
  currentOrdering: string | null,
  field: string
): string | null {
  if (currentOrdering === field) {
    return `-${field}`;
  }

  if (currentOrdering === `-${field}`) {
    return null;
  }

  return field;
}