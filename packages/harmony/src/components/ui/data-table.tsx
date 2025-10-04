'use client';

/**
 * Data Table
 *
 * A composable data table built on TanStack Table v8. Offers a simple default layout
 * and a fully composable API via subcomponents.
 *
 * Features
 * - Global search and column filters (text, number, select)
 * - Sorting, column visibility, pinning, drag reordering
 * - Optional row selection column
 * - Controlled or uncontrolled pagination
 * - Density: default or compact
 * - Loading skeletons
 */

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import type { Table as ReactTableInstance, Row } from '@tanstack/react-table';
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { GripVertical, ListFilter, Search, Settings2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export type DataTableDensity = 'default' | 'compact';

export type DataTableFilterVariant = 'text' | 'number' | 'select';

/** Props for DataTable */
export interface DataTableProps<TData, TValue> {
  /**
   * Column definitions for TanStack Table.
   * - Use column `meta` to control built-in UI (e.g., filterVariant, filterOptions, headerLabel).
   */
  columns: ColumnDef<TData, TValue>[];
  /** Array of row objects to render. */
  data: TData[];
  /** Additional class names applied to the root wrapper. */
  className?: string;
  /**
   * Shows loading skeletons (5 rows) instead of data. Applies to both default and composable layouts.
   */
  loading?: boolean;
  /** Whether to render the global search input. Defaults to true. */
  searchable?: boolean;
  /** Placeholder text for the global search input. */
  searchPlaceholder?: string;
  /** Whether the Columns visibility menu is available. */
  columnVisibility?: boolean;
  /** Whether pin/unpin options appear in the column header menu. */
  columnPinning?: boolean;
  /** Whether columns can be drag-reordered. */
  columnOrdering?: boolean;
  /** Whether column sorting is enabled (click header to toggle). */
  sorting?: boolean;
  /** Adds a leading selection checkbox column when true. */
  selection?: boolean;
  /** Adjust cell padding density. */
  density?: DataTableDensity;
  /** Initial column visibility state for the table (uncontrolled usage). */
  initialColumnVisibility?: VisibilityState;
  /** Initial sorting state for the table (uncontrolled usage). */
  initialSorting?: SortingState;
  /** Initial column filters (uncontrolled usage). */
  initialColumnFilters?: ColumnFiltersState;
  /** Initial column pinning state (uncontrolled usage). */
  initialColumnPinning?: ColumnPinningState;
  /** Initial column order state (uncontrolled usage). */
  initialColumnOrder?: ColumnOrderState;
  /**
   * Controlled pagination. When provided, the table uses manual pagination and the UI calls back via provided handlers.
   * - pageIndex/pageSize: current pagination state
   * - pageCount: total pages (required for Next/Last enablement)
   * - onPageChange: called with the new page index
   * - onPageSizeChange: optional; when provided, a page size select is rendered
   * - pageSizeOptions: options for the page size select (default [10,20,50,100])
   *
   * If omitted, the table manages internal pagination and the default pagination controls call TanStack table methods.
   */
  pagination?: {
    /** Current zero-based page index */
    pageIndex: number;
    /** Current page size */
    pageSize: number;
    /** Total number of pages (server-side); required to enable Next/Last appropriately */
    pageCount?: number;
    /** Callback when the user requests a page change */
    onPageChange: (pageIndex: number) => void;
    /** Optional callback to change page size; enables the page size select */
    onPageSizeChange?: (pageSize: number) => void;
    /** Page size options to show when onPageSizeChange is provided */
    pageSizeOptions?: number[];
  };
  /**
   * If provided, enables the Filters menu and optionally restricts which columns are filterable by id.
   * When omitted, the Filters control is hidden.
   */
  filters?: { columns?: string[] };
  /** Custom top toolbar content or render function receiving the table instance. */
  renderTopToolbar?: React.ReactNode | ((table: ReactTableInstance<TData>) => React.ReactNode);
  /** Custom bottom toolbar content or render function receiving the table instance. */
  renderBottomToolbar?: React.ReactNode | ((table: ReactTableInstance<TData>) => React.ReactNode);
  /**
   * When children are provided, the component enters composable mode and renders only children.
   * Use subcomponents to build your own layout: Toolbar/Search/Filters/Columns/Content/Pagination.
   */
  children?: React.ReactNode;
}

/** Column-level metadata used by the built-in UI */
type ColumnMeta = {
  /**
   * Which filter control to render in the Filters menu.
   * - 'text': string contains
   * - 'number': exact numeric equality
   * - 'select': equality against selected value (supports boolean casting)
   */
  filterVariant?: DataTableFilterVariant;
  /** Options to show for 'select' filter variant (label/value pairs). */
  filterOptions?: Array<{ label: string; value: string }>;
  /** If false, hides this column from the Columns visibility menu. */
  enableHiding?: boolean;
  /** If false, disables drag-reordering for this column. */
  enableOrdering?: boolean;
  /** Optional aria-label or tooltip label for the header. */
  headerLabel?: string;
  /** If false, hides the header kebab menu. */
  enableHeaderMenu?: boolean;
};

// DataTable context and hook
type DataTableContextValue<TData> = {
  table: ReactTableInstance<TData>;
  searchable: boolean;
  searchPlaceholder: string;
  columnVisibility: boolean;
  columnPinning: boolean;
  columnOrdering: boolean;
  filters: { columns?: string[] } | undefined;
  pagination: DataTableProps<TData, unknown>['pagination'];
  density: DataTableDensity;
  loading: boolean;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  onDragEnd: (event: DragEndEvent) => void | undefined;
};

/** React context providing access to the table instance and UI config */
const DataTableContext = React.createContext<DataTableContextValue<unknown> | null>(null);

/**
 * Hook to access Data Table context.
 * Must be used within a <DataTable> instance.
 */
function useDataTable<TData>(): DataTableContextValue<TData> {
  const ctx = React.useContext(DataTableContext);
  if (!ctx) throw new Error('useDataTable must be used within <DataTable>');
  return ctx as DataTableContextValue<TData>;
}

/**
 * DataTable root component.
 *
 * Rendering modes
 * - Default: no children → renders Toolbar, Content, Pagination according to props
 * - Composable: with children → renders only children; use subcomponents to compose
 *
 * State model
 * - Sorting, filters, visibility, pinning and order are internally managed (uncontrolled),
 *   with optional initial* props to set defaults.
 * - Pagination is uncontrolled by default; provide `pagination` for controlled/server mode.
 * - Global search is enabled when `searchable` is true and only applies to string-like columns.
 */
export function DataTable<TData, TValue = unknown>(props: DataTableProps<TData, TValue>) {
  const {
    columns,
    data,
    className,
    loading = false,
    searchable = true,
    searchPlaceholder = 'Search…',
    columnVisibility = true,
    columnPinning = true,
    columnOrdering = true,
    sorting = true,
    selection = false,
    density: densityProp = 'default',
    initialColumnVisibility,
    initialSorting,
    initialColumnFilters,
    initialColumnPinning,
    initialColumnOrder,
    pagination,
    filters,
    renderTopToolbar,
    renderBottomToolbar,
    children,
  } = props;

  const [globalFilter, setGlobalFilter] = React.useState('');
  const [sortingState, setSortingState] = React.useState<SortingState>(initialSorting ?? []);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(initialColumnFilters ?? []);
  const [columnVisibilityState, setColumnVisibilityState] = React.useState<VisibilityState>(
    initialColumnVisibility ?? {}
  );
  const [columnPinningState, setColumnPinningState] = React.useState<ColumnPinningState>(initialColumnPinning ?? {});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(initialColumnOrder ?? []);
  const density = densityProp;
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [internalPagination, setInternalPagination] = React.useState<{ pageIndex: number; pageSize: number }>({
    pageIndex: 0,
    pageSize: 10,
  });
  const effectivePagination = pagination ?? internalPagination;

  /**
   * Build effective columns by injecting selection column when enabled and
   * attaching filterFns according to column meta definitions.
   */
  const computedColumns = React.useMemo(() => {
    const normalizeColumn = (col: ColumnDef<TData, TValue>): ColumnDef<TData, TValue> => {
      const meta = (col.meta as ColumnMeta | undefined) ?? {};
      if (meta.filterVariant === 'select') {
        return {
          ...col,
          filterFn: (row: Row<TData>, id: string, filterValue: string | number | boolean | undefined) => {
            if (filterValue === undefined || filterValue === '') return true;
            const rowValue = row.getValue(id);
            if (typeof rowValue === 'boolean') {
              const normalized = typeof filterValue === 'boolean' ? filterValue : String(filterValue) === 'true';
              return rowValue === normalized;
            }
            if (rowValue == null) return false;
            if (typeof rowValue === 'string') return rowValue === String(filterValue);
            if (typeof rowValue === 'number') return rowValue === Number(filterValue);
            return false;
          },
        } as unknown as ColumnDef<TData, TValue>;
      }
      if (meta.filterVariant === 'number') {
        return {
          ...col,
          filterFn: (row: Row<TData>, id: string, filterValue: unknown) => {
            if (filterValue === undefined || filterValue === '') return true;
            const rowValue = row.getValue(id);
            const nRow = Number(rowValue);
            const nFilter = Number(filterValue);
            return Number.isFinite(nRow) && Number.isFinite(nFilter) && nRow === nFilter;
          },
        } as unknown as ColumnDef<TData, TValue>;
      }
      return col;
    };

    const userColumns = columns.map(normalizeColumn) as Array<ColumnDef<TData, unknown>>;

    if (!selection) return userColumns;

    const selectCol: ColumnDef<TData, unknown> = {
      id: '__select',
      header: ({ table }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && 'indeterminate')}
            onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { enableHiding: false, enableOrdering: false, enableHeaderMenu: false },
      size: 40,
      minSize: 40,
      maxSize: 40,
    };

    return [selectCol, ...userColumns];
  }, [columns, selection]);

  /** Create TanStack Table instance */
  const table = useReactTable<TData>({
    data,
    columns: computedColumns,
    enableSorting: sorting,
    enableRowSelection: selection,
    manualPagination: Boolean(pagination),
    pageCount: pagination?.pageCount,
    state: {
      sorting: sortingState,
      columnFilters,
      columnVisibility: columnVisibilityState,
      columnPinning: columnPinningState,
      columnOrder,
      globalFilter,
      rowSelection,
      pagination: { pageIndex: effectivePagination.pageIndex, pageSize: effectivePagination.pageSize },
    },
    globalFilterFn: 'auto',
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSortingState,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibilityState,
    onColumnPinningChange: setColumnPinningState,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      if (!pagination) {
        setInternalPagination((prev) =>
          typeof updater === 'function'
            ? (
                updater as (old: { pageIndex: number; pageSize: number }) => {
                  pageIndex: number;
                  pageSize: number;
                }
              )(prev)
            : (updater as { pageIndex: number; pageSize: number })
        );
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    ...(pagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    initialState: {
      columnVisibility: initialColumnVisibility,
      columnPinning: initialColumnPinning,
      columnOrder: initialColumnOrder,
    },
    getColumnCanGlobalFilter: (column) => {
      const valueType = column.getFacetedMinMaxValues?.()
        ? 'number'
        : typeof column.getFacetedRowModel()?.flatRows?.[0]?.getValue(column.id) === 'string'
          ? 'string'
          : undefined;
      return valueType === 'string';
    },
  });

  // Update column order default to all leaf columns if empty to enable drag
  /** Initialize column order to support drag when unset */
  React.useEffect(() => {
    if (!columnOrder || columnOrder.length === 0) {
      setColumnOrder(table.getAllLeafColumns().map((c) => c.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  /**
   * Handle DnD end to reorder columns, respecting current pinning and ordering flags.
   */
  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      if (!columnOrdering) return;
      const { active, over } = event;
      if (!active || !over) return;
      if (active.id === over.id) return;

      setColumnOrder((current) => {
        const oldIndex = current.indexOf(String(active.id));
        const newIndex = current.indexOf(String(over.id));
        return arrayMove(current, oldIndex, newIndex);
      });
    },
    [columnOrdering]
  );

  const headerCellPadding = density === 'compact' ? 'px-2 py-1.5' : 'px-4 py-3';
  const bodyCellPadding = density === 'compact' ? 'p-2' : 'p-4';

  /** Render default top toolbar (or custom via renderTopToolbar) */
  const topToolbar = (() => {
    // Determine which tools should render
    const showSearch = Boolean(searchable);
    const hasHideableColumn = table
      .getAllLeafColumns()
      .some((col) => ((col.columnDef.meta as ColumnMeta | undefined)?.enableHiding ?? true) !== false);
    const showColumnsMenu = Boolean(columnVisibility && hasHideableColumn);

    // Compute filterable columns only if filters prop provided
    let uiFilterColumns: ReturnType<typeof table.getAllLeafColumns> = [];
    if (filters) {
      uiFilterColumns = table.getAllLeafColumns().filter((c) => c.getCanFilter());
      if (filters.columns && filters.columns.length > 0) {
        const allowed = new Set(filters.columns);
        uiFilterColumns = uiFilterColumns.filter((c) => allowed.has(c.id));
      }
    }
    const showFilters = Boolean(filters) && uiFilterColumns.length > 0;

    // If nothing to render, return null
    const nothingToShow = !showSearch && !showColumnsMenu && !showFilters;

    const content = nothingToShow ? null : (
      <div className="flex w-full items-center gap-2">
        {showSearch && (
          <div className="flex min-w-[200px] flex-1">
            <Input
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              leftElement={<Search className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        )}

        {showColumnsMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Columns">
                <Settings2 />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((col) => (col.columnDef.meta as ColumnMeta | undefined)?.enableHiding !== false)
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                  >
                    {column.columnDef.header as React.ReactNode}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {showFilters && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Filters">
                <ListFilter className="h-4 w-4" />
                Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-64 p-2">
              {uiFilterColumns.map((column) => {
                const meta = (column.columnDef.meta as ColumnMeta | undefined) ?? {};
                const variant: DataTableFilterVariant = meta.filterVariant ?? 'text';
                const id = `filter-${column.id}`;
                return (
                  <div key={column.id} className="flex items-center gap-2 p-1.5">
                    <label htmlFor={id} className="w-28 shrink-0 text-sm text-muted-foreground">
                      {column.columnDef.header as React.ReactNode}
                    </label>
                    {variant === 'text' && (
                      <Input
                        id={id}
                        value={(column.getFilterValue() as string) ?? ''}
                        onChange={(e) => column.setFilterValue(e.target.value)}
                        placeholder="Contains…"
                      />
                    )}
                    {variant === 'number' && (
                      <Input
                        id={id}
                        type="number"
                        value={(column.getFilterValue() as string | number | undefined) ?? ''}
                        onChange={(e) =>
                          column.setFilterValue(e.target.value === '' ? undefined : Number(e.target.value))
                        }
                        placeholder="Equals…"
                      />
                    )}
                    {variant === 'select' &&
                      (() => {
                        const sample = column.getFacetedRowModel?.()?.flatRows?.[0]?.getValue(column.id);
                        const isBoolean = typeof sample === 'boolean';
                        const raw = column.getFilterValue();
                        const value =
                          raw === undefined
                            ? ''
                            : isBoolean
                              ? String(Boolean(raw))
                              : typeof raw === 'string' || typeof raw === 'number'
                                ? String(raw)
                                : '';
                        return (
                          <select
                            id={id}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={value}
                            onChange={(e) => {
                              const v = e.target.value;
                              column.setFilterValue(v === '' ? undefined : isBoolean ? v === 'true' : v);
                            }}
                          >
                            <option value="">All</option>
                            {((meta.filterOptions ?? []) as Array<{ label: string; value: string }>).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );

    if (typeof renderTopToolbar === 'function') {
      const custom = (renderTopToolbar as (t: ReactTableInstance<TData>) => React.ReactNode)(
        table as unknown as ReactTableInstance<TData>
      );
      return custom !== undefined ? custom : content;
    }
    if (renderTopToolbar !== undefined) return renderTopToolbar;
    return content;
  })();

  /** Render default bottom toolbar (or custom via renderBottomToolbar) */
  const bottomToolbar = (() => {
    if (!pagination) return null;
    const pageIndex = pagination.pageIndex;
    const pageSize = pagination.pageSize;
    const pageCount = pagination.pageCount ?? undefined;
    const canPrev = pageIndex > 0;
    const canNext = pageCount !== undefined ? pageIndex < pageCount - 1 : false;
    const onSizeChange = pagination.onPageSizeChange;
    const pageSizeOptions = pagination.pageSizeOptions ?? [10, 20, 50, 100];
    const content = (
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Page {pageIndex + 1}
            {pageCount !== undefined ? ` of ${Math.max(pageCount, 1)}` : ''}
          </span>
          {onSizeChange && (
            <>
              <span className="hidden md:inline">•</span>
              <label className="hidden items-center gap-2 md:flex">
                <span>Rows per page</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => onSizeChange?.(Number(e.target.value))}
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => pagination.onPageChange(0)} disabled={!canPrev}>
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(Math.max(0, pageIndex - 1))}
            disabled={!canPrev}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(pageIndex + 1)}
            disabled={!canNext}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(Math.max(0, (pageCount ?? 1) - 1))}
            disabled={!canNext}
          >
            Last
          </Button>
        </div>
      </div>
    );
    if (typeof renderBottomToolbar === 'function') return renderBottomToolbar(table) ?? content;
    if (renderBottomToolbar) return renderBottomToolbar;
    return content;
  })();

  const contextValue: DataTableContextValue<TData> = {
    table: table as unknown as ReactTableInstance<TData>,
    searchable,
    searchPlaceholder,
    columnVisibility,
    columnPinning,
    columnOrdering,
    filters,
    pagination,
    density,
    loading,
    globalFilter,
    setGlobalFilter,
    onDragEnd: (event: DragEndEvent) => handleDragEnd(event),
  };

  const hasChildren = React.Children.count(children) > 0;

  return (
    <DataTableContext.Provider value={contextValue as unknown as DataTableContextValue<unknown>}>
      <div className={cn('flex w-full flex-col', className)}>
        {!hasChildren && topToolbar ? (
          <div className={cn('flex items-center justify-between gap-2')}>{topToolbar}</div>
        ) : null}

        {!hasChildren ? (
          <div className={cn('relative')}>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    <DndContext onDragEnd={handleDragEnd}>
                      <SortableContext
                        items={headerGroup.headers.filter((h) => !h.isPlaceholder).map((h) => h.column.id)}
                        strategy={horizontalListSortingStrategy}
                      >
                        {headerGroup.headers.map((header) => {
                          const isPinned = header.column.getIsPinned();
                          const meta = (header.column.columnDef.meta as ColumnMeta | undefined) ?? {};
                          const canOrder = columnOrdering && (meta.enableOrdering ?? true);
                          return (
                            <TableHead key={header.id} className={cn('align-middle', headerCellPadding)}>
                              {header.isPlaceholder ? null : (
                                <SortableHeader id={header.column.id} disabled={!canOrder || Boolean(isPinned)}>
                                  <div className="flex items-center gap-2">
                                    {canOrder && !isPinned && (
                                      <span className="inline-flex">
                                        <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                                      </span>
                                    )}
                                    <div
                                      role={header.column.getCanSort() ? 'button' : undefined}
                                      aria-label={meta.headerLabel}
                                      className={cn(
                                        'flex select-none items-center gap-1',
                                        header.column.getCanSort() && 'cursor-pointer'
                                      )}
                                      onClick={header.column.getToggleSortingHandler()}
                                    >
                                      {flexRender(header.column.columnDef.header, header.getContext())}
                                      {header.column.getIsSorted() === 'asc' && <span aria-hidden>↑</span>}
                                      {header.column.getIsSorted() === 'desc' && <span aria-hidden>↓</span>}
                                    </div>

                                    {(columnPinning || (meta.enableHiding ?? true)) &&
                                      (meta.enableHeaderMenu ?? true) && (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" aria-label="Column options">
                                              ⋯
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="start">
                                            {columnPinning && (
                                              <>
                                                <DropdownMenuLabel>Pin</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => header.column.pin('left')}>
                                                  Pin left
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => header.column.pin(false)}>
                                                  Unpin
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => header.column.pin('right')}>
                                                  Pin right
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                              </>
                                            )}
                                            {header.column.getCanHide() && (
                                              <DropdownMenuItem onClick={() => header.column.toggleVisibility(false)}>
                                                Hide column
                                              </DropdownMenuItem>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )}
                                  </div>
                                </SortableHeader>
                              )}
                            </TableHead>
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`loading-${i}`}>
                      {table.getAllLeafColumns().map((col) => (
                        <TableCell key={col.id} className={bodyCellPadding}>
                          <Skeleton className="h-4 w-3/4" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={bodyCellPadding}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={table.getAllLeafColumns().length}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      No results
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <>{children}</>
        )}

        {!hasChildren && bottomToolbar ? <div>{bottomToolbar}</div> : null}
      </div>
    </DataTableContext.Provider>
  );
}

// Composable subcomponents
/**
 * DataTableContent
 * Renders the table header and body using the shared table instance from context.
 */
function DataTableContent(): JSX.Element {
  const { table, columnOrdering, columnPinning, density, onDragEnd, loading } = useDataTable<unknown>();
  const headerCellPadding = density === 'compact' ? 'px-2 py-1.5' : 'px-4 py-3';
  const bodyCellPadding = density === 'compact' ? 'p-2' : 'p-4';

  return (
    <div className="relative">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              <DndContext onDragEnd={onDragEnd}>
                <SortableContext
                  items={headerGroup.headers.filter((h) => !h.isPlaceholder).map((h) => h.column.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {headerGroup.headers.map((header) => {
                    const isPinned = header.column.getIsPinned();
                    const meta = (header.column.columnDef.meta as ColumnMeta | undefined) ?? {};
                    const canOrder = columnOrdering && (meta.enableOrdering ?? true);
                    return (
                      <TableHead key={header.id} className={cn('align-middle', headerCellPadding)}>
                        {header.isPlaceholder ? null : (
                          <SortableHeader id={header.column.id} disabled={!canOrder || Boolean(isPinned)}>
                            <div className="flex items-center gap-2">
                              {canOrder && !isPinned && (
                                <span className="inline-flex">
                                  <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                                </span>
                              )}
                              <div
                                role={header.column.getCanSort() ? 'button' : undefined}
                                className={cn(
                                  'flex select-none items-center gap-1',
                                  header.column.getCanSort() && 'cursor-pointer'
                                )}
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getIsSorted() === 'asc' && <span aria-hidden>↑</span>}
                                {header.column.getIsSorted() === 'desc' && <span aria-hidden>↓</span>}
                              </div>
                              {(columnPinning || (meta.enableHiding ?? true)) && (meta.enableHeaderMenu ?? true) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Column options">
                                      ⋯
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    {columnPinning && (
                                      <>
                                        <DropdownMenuLabel>Pin</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => header.column.pin('left')}>
                                          Pin left
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => header.column.pin(false)}>
                                          Unpin
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => header.column.pin('right')}>
                                          Pin right
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </>
                                    )}
                                    {header.column.getCanHide() && (
                                      <DropdownMenuItem onClick={() => header.column.toggleVisibility(false)}>
                                        Hide column
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </SortableHeader>
                        )}
                      </TableHead>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`loading-${i}`}>
                {table.getAllLeafColumns().map((col) => (
                  <TableCell key={col.id} className={bodyCellPadding}>
                    <Skeleton className="h-4 w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={bodyCellPadding}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getAllLeafColumns().length}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No results
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** Toolbar wrapper for composing search/filters/columns controls */
function DataTableToolbar({ children }: { children?: React.ReactNode }): JSX.Element | null {
  const content = children ? <div className="flex items-center justify-between gap-2">{children}</div> : null;
  return content;
}

/** Global search input bound to the table's global filter */
function DataTableSearch() {
  const { searchable, searchPlaceholder, globalFilter, setGlobalFilter } = useDataTable<unknown>();
  if (!searchable) return null;
  return (
    <div className="flex min-w-[200px] flex-1">
      <Input
        value={globalFilter ?? ''}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder={searchPlaceholder}
        leftElement={<Search className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
}

/** Columns visibility menu for toggling leaf columns */
function DataTableColumns() {
  const { table, columnVisibility } = useDataTable<unknown>();
  if (!columnVisibility) return null;
  const hasHideable = table
    .getAllLeafColumns()
    .some((col) => ((col.columnDef.meta as ColumnMeta | undefined)?.enableHiding ?? true) !== false);
  if (!hasHideable) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Columns">
          <Settings2 className="h-4 w-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllLeafColumns()
          .filter((col) => (col.columnDef.meta as ColumnMeta | undefined)?.enableHiding !== false)
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
            >
              {column.columnDef.header as React.ReactNode}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Filters dropdown that renders appropriate input controls based on column meta.
 * Accepts optional `columns` to limit which columns are shown, otherwise uses prop.
 */
function DataTableFilters({ columns }: { columns?: string[] }) {
  const { table, filters } = useDataTable<unknown>();
  const configColumns = columns ?? filters?.columns;
  let uiColumns = table.getAllLeafColumns().filter((c) => c.getCanFilter());
  if (configColumns && configColumns.length > 0) {
    const allowed = new Set(configColumns);
    uiColumns = uiColumns.filter((c) => allowed.has(c.id));
  }
  if (uiColumns.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Filters">
          <ListFilter />
          Filters
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64 p-2">
        {uiColumns.map((column) => {
          const meta = (column.columnDef.meta as ColumnMeta | undefined) ?? {};
          const variant: DataTableFilterVariant = meta.filterVariant ?? 'text';
          const id = `filter-${column.id}`;
          return (
            <div key={column.id} className="flex items-center gap-2 p-1.5">
              <label htmlFor={id} className="w-28 shrink-0 text-sm text-muted-foreground">
                {column.columnDef.header as React.ReactNode}
              </label>
              {variant === 'text' && (
                <Input
                  id={id}
                  value={(column.getFilterValue() as string) ?? ''}
                  onChange={(e) => column.setFilterValue(e.target.value)}
                  placeholder="Contains…"
                />
              )}
              {variant === 'number' && (
                <Input
                  id={id}
                  type="number"
                  value={(column.getFilterValue() as string | number | undefined) ?? ''}
                  onChange={(e) => column.setFilterValue(e.target.value === '' ? undefined : Number(e.target.value))}
                  placeholder="Equals…"
                />
              )}
              {variant === 'select' &&
                (() => {
                  const sample = column.getFacetedRowModel?.()?.flatRows?.[0]?.getValue(column.id);
                  const isBoolean = typeof sample === 'boolean';
                  const raw = column.getFilterValue();
                  const value =
                    raw === undefined
                      ? ''
                      : isBoolean
                        ? String(Boolean(raw))
                        : typeof raw === 'string' || typeof raw === 'number'
                          ? String(raw)
                          : '';
                  return (
                    <select
                      id={id}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={value}
                      onChange={(e) => {
                        const v = e.target.value;
                        column.setFilterValue(v === '' ? undefined : isBoolean ? v === 'true' : v);
                      }}
                    >
                      <option value="">All</option>
                      {(meta.filterOptions ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  );
                })()}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Pagination controls. Works with controlled or internal pagination. */
function DataTablePagination() {
  const { table, pagination } = useDataTable<unknown>();
  if (pagination) {
    const pageIndex = pagination.pageIndex;
    const pageSize = pagination.pageSize;
    const pageCount = pagination.pageCount ?? undefined;
    const canPrev = pageIndex > 0;
    const canNext = pageCount !== undefined ? pageIndex < pageCount - 1 : false;
    const onSizeChange = pagination.onPageSizeChange;
    const pageSizeOptions = pagination.pageSizeOptions ?? [10, 20, 50, 100];
    return (
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Page {pageIndex + 1}
            {pageCount !== undefined ? ` of ${Math.max(pageCount, 1)}` : ''}
          </span>
          {onSizeChange && (
            <>
              <span className="hidden md:inline">•</span>
              <label className="hidden items-center gap-2 md:flex">
                <span>Rows per page</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => onSizeChange?.(Number(e.target.value))}
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => pagination.onPageChange(0)} disabled={!canPrev}>
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(Math.max(0, pageIndex - 1))}
            disabled={!canPrev}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(pageIndex + 1)}
            disabled={!canNext}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(Math.max(0, (pageCount ?? 1) - 1))}
            disabled={!canNext}
          >
            Last
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
          First
        </Button>
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Prev
        </Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.setPageIndex(Math.max(0, table.getPageCount() - 1))}
          disabled={!table.getCanNextPage()}
        >
          Last
        </Button>
      </div>
    </div>
  );
}

export {
  DataTableColumns,
  DataTableContent,
  DataTableFilters,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  useDataTable,
};

export default DataTable;

/**
 * DnD sortable header wrapper that wires up drag attributes and transforms.
 */
function SortableHeader({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: transition || undefined,
    opacity: isDragging ? 0.6 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center">
      {children}
    </div>
  );
}
