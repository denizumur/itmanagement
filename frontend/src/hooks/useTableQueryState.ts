import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { getNextOrdering } from "../lib/tableQuery";
import type { TableQueryDefaults, TableQueryState } from "../types/table";

const FILTER_PREFIX = "filter_";

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseFilters(searchParams: URLSearchParams) {
  const filters: Record<string, string | string[]> = {};

  searchParams.forEach((_, key) => {
    if (!key.startsWith(FILTER_PREFIX)) {
      return;
    }

    const filterKey = key.slice(FILTER_PREFIX.length);
    const values = searchParams.getAll(key).filter(Boolean);

    if (values.length === 1) {
      filters[filterKey] = values[0];
    }

    if (values.length > 1) {
      filters[filterKey] = values;
    }
  });

  return filters;
}

export function useTableQueryState(defaults: TableQueryDefaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo<TableQueryState>(() => {
    return {
      page: parsePositiveInteger(
        searchParams.get("page"),
        defaults.page ?? 1
      ),
      pageSize: parsePositiveInteger(
        searchParams.get("page_size"),
        defaults.pageSize ?? 25
      ),
      ordering: searchParams.get("ordering") ?? defaults.ordering ?? null,
      search: searchParams.get("search") ?? defaults.search ?? "",
      filters: parseFilters(searchParams),
    };
  }, [
    defaults.ordering,
    defaults.page,
    defaults.pageSize,
    defaults.search,
    searchParams,
  ]);

  function updateParams(updates: Record<string, string | number | null>) {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        next.delete(key);
        return;
      }

      next.set(key, String(value));
    });

    setSearchParams(next);
  }

  function setPage(page: number) {
    updateParams({ page });
  }

  function setPageSize(pageSize: number) {
    updateParams({ page_size: pageSize, page: 1 });
  }

  function setSearch(search: string) {
    updateParams({ search, page: 1 });
  }

  function setSort(field: string) {
    const nextOrdering = getNextOrdering(state.ordering, field);

    updateParams({ ordering: nextOrdering, page: 1 });
  }

  function setFilter(key: string, value: string | string[] | null) {
    const paramKey = `${FILTER_PREFIX}${key}`;
    const next = new URLSearchParams(searchParams);

    next.delete(paramKey);

    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => {
        next.append(paramKey, item);
      });
    } else if (value) {
      next.set(paramKey, value);
    }

    next.set("page", "1");

    setSearchParams(next);
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams);

    Array.from(next.keys()).forEach((key) => {
      if (key.startsWith(FILTER_PREFIX)) {
        next.delete(key);
      }
    });

    next.delete("search");
    next.delete("ordering");
    next.set("page", "1");

    setSearchParams(next);
  }

  return {
    state,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setFilter,
    resetFilters,
  };
}