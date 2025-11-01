'use client';

import type { PaginationState, SortingState } from '@/components/ui/data-table';
import * as React from 'react';

/**
 * Configuration options for the data table hook
 */
export interface UseDataTableOptions<TData, TFilters = Record<string, unknown>> {
  /** Function to fetch data from the server */
  fetchData: (params: { pagination: PaginationState; sorting: SortingState | null; filters: TFilters }) => Promise<{
    data: TData[];
    totalRows: number;
  }>;
  /** Initial pagination state */
  initialPagination?: PaginationState;
  /** Initial sorting state */
  initialSorting?: SortingState | null;
  /** Initial filters */
  initialFilters?: TFilters;
  /** Whether to fetch data on mount */
  fetchOnMount?: boolean;
}

/**
 * Return type for the data table hook
 */
export interface UseDataTableReturn<TData, TFilters = Record<string, unknown>> {
  /** Current data */
  data: TData[];
  /** Total number of rows */
  totalRows: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Current pagination state */
  pagination: PaginationState;
  /** Update pagination */
  setPagination: (pagination: PaginationState) => void;
  /** Current sorting state */
  sorting: SortingState | null;
  /** Update sorting */
  setSorting: (sorting: SortingState | null) => void;
  /** Current filters */
  filters: TFilters;
  /** Update filters */
  setFilters: (filters: TFilters | ((prev: TFilters) => TFilters)) => void;
  /** Manually refetch data */
  refetch: () => Promise<void>;
}

/**
 * A hook to manage data table state and server-side data fetching.
 * Handles pagination, sorting, filtering, and automatic refetching.
 *
 * @example
 * ```tsx
 * const table = useDataTable({
 *   fetchData: async ({ pagination, sorting, filters }) => {
 *     const response = await fetch('/api/users', {
 *       method: 'POST',
 *       body: JSON.stringify({ pagination, sorting, filters })
 *     })
 *     return response.json()
 *   },
 *   initialPagination: { pageIndex: 0, pageSize: 10 }
 * })
 *
 * return (
 *   <DataTable
 *     data={table.data}
 *     pagination={table.pagination}
 *     onPaginationChange={table.setPagination}
 *     sorting={table.sorting}
 *     onSortingChange={table.setSorting}
 *     totalRows={table.totalRows}
 *     isLoading={table.isLoading}
 *   />
 * )
 * ```
 */
export function useDataTable<TData, TFilters = Record<string, unknown>>({
  fetchData,
  initialPagination = { pageIndex: 0, pageSize: 10 },
  initialSorting = null,
  initialFilters = {} as TFilters,
  fetchOnMount = true,
}: UseDataTableOptions<TData, TFilters>): UseDataTableReturn<TData, TFilters> {
  const [data, setData] = React.useState<TData[]>([]);
  const [totalRows, setTotalRows] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [pagination, setPagination] = React.useState(initialPagination);
  const [sorting, setSorting] = React.useState(initialSorting);
  const [filters, setFilters] = React.useState(initialFilters);

  /**
   * Fetch data from the server
   */
  const refetch = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchData({ pagination, sorting, filters });
      setData(result.data);
      setTotalRows(result.totalRows);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchData, pagination, sorting, filters]);

  // Fetch data when dependencies change
  React.useEffect(() => {
    if (fetchOnMount) {
      void refetch();
    }
  }, [refetch, fetchOnMount]);

  return {
    data,
    totalRows,
    isLoading,
    error,
    pagination,
    setPagination,
    sorting,
    setSorting,
    filters,
    setFilters,
    refetch,
  };
}
