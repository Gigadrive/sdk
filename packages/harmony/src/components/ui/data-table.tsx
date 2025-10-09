'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type SortingState as TanStackSortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, Settings2 } from 'lucide-react';
import * as React from 'react';

interface ColumnMeta {
  width?: string;
}

/**
 * Column definition for the data table
 * @template TData - The type of data in each row
 */
export interface DataTableColumn<TData> {
  /** Unique identifier for the column */
  id: string;
  /** Display header for the column */
  header: string;
  /** Accessor key for simple property access */
  accessorKey?: keyof TData;
  /** Accessor function to get cell value from row data (for computed values) */
  accessorFn?: (row: TData) => string | number | boolean | null | undefined;
  /** Custom cell renderer */
  cell?: (row: TData) => React.ReactNode;
  /** Whether this column can be sorted */
  sortable?: boolean;
  /** Whether this column can be hidden */
  hideable?: boolean;
  /** Default visibility state */
  defaultVisible?: boolean;
  /** Custom width class */
  width?: string;
}

/**
 * Sorting state for a column
 */
export interface SortingState {
  /** Column ID being sorted */
  id: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Pagination state
 */
export interface PaginationState {
  /** Current page index (0-based) */
  pageIndex: number;
  /** Number of items per page */
  pageSize: number;
}

/**
 * Props for the DataTable component
 * @template TData - The type of data in each row
 */
export interface DataTableProps<TData> {
  /** Column definitions */
  columns: DataTableColumn<TData>[];
  /** Row data */
  data: TData[];
  /** Optional: Enable column reordering via drag and drop */
  enableColumnReordering?: boolean;
  /** Optional: Enable column visibility toggling */
  enableColumnVisibility?: boolean;
  /** Optional: Current sorting state */
  sorting?: SortingState | null;
  /** Optional: Callback when sorting changes */
  onSortingChange?: (sorting: SortingState | null) => void;
  /** Optional: Current pagination state */
  pagination?: PaginationState;
  /** Optional: Callback when pagination changes */
  onPaginationChange?: (pagination: PaginationState) => void;
  /** Optional: Total number of rows (for server-side pagination) */
  totalRows?: number;
  /** Optional: Loading state */
  isLoading?: boolean;
  /** Optional: Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional: Custom empty state */
  emptyState?: React.ReactNode;
  /** Optional: Custom loading state */
  loadingState?: React.ReactNode;
  /** Optional: Additional class name */
  className?: string;
  /** Optional: Enable page size selector */
  enablePageSizeSelector?: boolean;
  /** Optional: Available page sizes */
  pageSizeOptions?: number[];
}

/**
 * Sortable table header cell component
 */
function SortableTableHead({
  id,
  children,
  isDraggable,
}: {
  id: string;
  children: React.ReactNode;
  isDraggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableHead ref={setNodeRef} style={style} className="relative">
      <div className="flex items-center gap-2">
        {isDraggable && (
          <button className="cursor-grab active:cursor-grabbing touch-none" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {children}
      </div>
    </TableHead>
  );
}

/**
 * A composable, feature-rich data table component powered by TanStack Table with support for:
 * - Server-side pagination
 * - Server-side sorting
 * - Column reordering via drag and drop
 * - Column visibility toggling
 * - Multiple size variants
 *
 * @example
 * \`\`\`tsx
 * <DataTable
 *   columns={columns}
 *   data={data}
 *   enableColumnReordering
 *   enableColumnVisibility
 *   sorting={sorting}
 *   onSortingChange={setSorting}
 *   pagination={pagination}
 *   onPaginationChange={setPagination}
 *   totalRows={totalRows}
 * />
 * \`\`\`
 */
export function DataTable<TData>({
  columns: userColumns,
  data,
  enableColumnReordering = false,
  enableColumnVisibility = false,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  totalRows,
  isLoading = false,
  size = 'md',
  emptyState,
  loadingState,
  className,
  enablePageSizeSelector = false,
  pageSizeOptions = [10, 20, 50, 100],
}: DataTableProps<TData>) {
  const columns = React.useMemo<ColumnDef<TData, unknown>[]>(
    () =>
      userColumns.map((col) => ({
        id: col.id,
        header: col.header,
        accessorKey: col.accessorKey as string | undefined,
        accessorFn: col.accessorFn,
        // Only include cell if there's a custom renderer, otherwise let TanStack Table use default
        ...(col.cell && { cell: ({ row }) => col.cell!(row.original) }),
        enableSorting: col.sortable,
        enableHiding: col.hideable !== false,
        meta: {
          width: col.width,
        } as ColumnMeta,
      })),
    [userColumns]
  );

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
    const initial: VisibilityState = {};
    userColumns.forEach((col) => {
      if (col.defaultVisible === false) {
        initial[col.id] = false;
      }
    });
    return initial;
  });

  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(userColumns.map((col) => col.id));

  const tanstackSorting: TanStackSortingState = React.useMemo(() => {
    if (!sorting) return [];
    return [{ id: sorting.id, desc: sorting.direction === 'desc' }];
  }, [sorting]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    state: {
      sorting: tanstackSorting,
      columnVisibility,
      columnOrder,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    pageCount: pagination ? Math.ceil((totalRows ?? data.length) / pagination.pageSize) : undefined,
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Handle column reordering
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  /**
   * Handle sort change from dropdown
   */
  const handleSortChange = (columnId: string, direction: 'asc' | 'desc' | 'none') => {
    if (!onSortingChange) return;

    if (direction === 'none') {
      onSortingChange(null);
    } else {
      onSortingChange({ id: columnId, direction });
    }
  };

  /**
   * Calculate pagination info
   */
  const paginationInfo = React.useMemo(() => {
    if (!pagination) return null;

    const total = totalRows ?? data.length;
    const start = pagination.pageIndex * pagination.pageSize + 1;
    const end = Math.min((pagination.pageIndex + 1) * pagination.pageSize, total);
    const totalPages = Math.ceil(total / pagination.pageSize);

    return { start, end, total, totalPages };
  }, [pagination, totalRows, data.length]);

  // Size classes
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const cellPaddingClasses = {
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Column visibility toggle */}
      {enableColumnVisibility && (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Table className={sizeClasses[size]}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <SortableContext
                    items={headerGroup.headers.map((h) => h.column.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => {
                      const column = userColumns.find((col) => col.id === header.column.id);
                      const currentSort = sorting?.id === header.column.id ? sorting.direction : null;
                      const columnMeta = header.column.columnDef.meta as ColumnMeta | undefined;

                      return (
                        <SortableTableHead key={header.id} id={header.column.id} isDraggable={enableColumnReordering}>
                          <div className="flex items-center gap-2">
                            <span className={columnMeta?.width}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </span>
                            {column?.sortable && onSortingChange && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    {currentSort === 'asc' ? (
                                      <ArrowUp className="h-4 w-4" />
                                    ) : currentSort === 'desc' ? (
                                      <ArrowDown className="h-4 w-4" />
                                    ) : (
                                      <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem onClick={() => handleSortChange(header.column.id, 'asc')}>
                                    <ArrowUp className="mr-2 h-4 w-4" />
                                    Ascending
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSortChange(header.column.id, 'desc')}>
                                    <ArrowDown className="mr-2 h-4 w-4" />
                                    Descending
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSortChange(header.column.id, 'none')}>
                                    <ArrowUpDown className="mr-2 h-4 w-4" />
                                    Reset
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </SortableTableHead>
                      );
                    })}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                loadingState ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      {loadingState}
                    </TableCell>
                  </TableRow>
                ) : (
                  Array.from({ length: pagination?.pageSize ?? 10 }).map((_, index) => (
                    <TableRow key={index}>
                      {columns.map((_, cellIndex) => (
                        <TableCell key={cellIndex} className={cellPaddingClasses[size]}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {emptyState ?? 'No results.'}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const cellMeta = cell.column.columnDef.meta as ColumnMeta | undefined;
                      return (
                        <TableCell key={cell.id} className={cn(cellPaddingClasses[size], cellMeta?.width)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      {/* Pagination */}
      {pagination && onPaginationChange && paginationInfo && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Showing {paginationInfo.start} to {paginationInfo.end} of {paginationInfo.total} results
            </div>
            {enablePageSizeSelector && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select
                  value={pagination.pageSize.toString()}
                  onValueChange={(value) =>
                    onPaginationChange({
                      pageIndex: 0,
                      pageSize: Number(value),
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onPaginationChange({
                  ...pagination,
                  pageIndex: pagination.pageIndex - 1,
                })
              }
              disabled={pagination.pageIndex === 0}
            >
              Previous
            </Button>
            <div className="text-sm">
              Page {pagination.pageIndex + 1} of {paginationInfo.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onPaginationChange({
                  ...pagination,
                  pageIndex: pagination.pageIndex + 1,
                })
              }
              disabled={pagination.pageIndex >= paginationInfo.totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
