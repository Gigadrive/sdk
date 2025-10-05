import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DataTable,
  DataTableColumns,
  DataTableContent,
  DataTableFilters,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  useDataTable,
} from '@/components/ui/data-table';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ColumnDef } from '@tanstack/react-table';

type Person = {
  id: string;
  name: string;
  email: string;
  age: number;
  role: 'Admin' | 'Editor' | 'Viewer';
  active: boolean;
};

const data: Person[] = Array.from({ length: 137 }).map((_, i) => ({
  id: `user-${i + 1}`,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  age: 18 + ((i * 7) % 50),
  role: (['Admin', 'Editor', 'Viewer'] as const)[i % 3],
  active: i % 2 === 0,
}));

const columns: ColumnDef<Person>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span>,
    meta: { filterVariant: 'text', headerLabel: 'Name' },
  },
  {
    accessorKey: 'email',
    header: 'Email',
    meta: { filterVariant: 'text', headerLabel: 'Email' },
  },
  {
    accessorKey: 'age',
    header: 'Age',
    meta: { filterVariant: 'number', headerLabel: 'Age' },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    meta: {
      filterVariant: 'select',
      filterOptions: [
        { label: 'Admin', value: 'Admin' },
        { label: 'Editor', value: 'Editor' },
        { label: 'Viewer', value: 'Viewer' },
      ],
      headerLabel: 'Role',
    },
  },
  {
    accessorKey: 'active',
    header: 'Active',
    cell: ({ row }) => (row.getValue('active') ? 'Yes' : 'No'),
    meta: {
      filterVariant: 'select',
      filterOptions: [
        { label: 'Active', value: 'true' },
        { label: 'Inactive', value: 'false' },
      ],
    },
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    enableHiding: true,
    cell: () => (
      <Button size="sm" variant="outline">
        View
      </Button>
    ),
    meta: { enableOrdering: false, enableHeaderMenu: false },
  },
];

// Helper to bind generic for Storybook component typing
function DataTablePerson(props: React.ComponentProps<typeof DataTable<Person>>) {
  return <DataTable<Person> {...props} />;
}

const meta: Meta<typeof DataTablePerson> = {
  title: 'Components/Data Table',
  component: DataTablePerson,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Comprehensive data table built on TanStack Table v8 with a composable API.

## When to use
- Display medium-to-large tabular datasets
- Need search, filters, sorting, visibility, pinning or drag reordering
- Require either client or server pagination

## Features
- Global search (string columns auto-detected)
- Column filters: text, number, select (with options)
- Sorting (click header), column visibility & pinning, drag to reorder
- Optional row selection column
- Pagination: uncontrolled or fully controlled (server data)
- Density: default or compact
- Loading state skeletons

## Composable API
Use subcomponents for custom layouts:
- \`DataTableToolbar\`, \`DataTableSearch\`, \`DataTableFilters\`, \`DataTableColumns\`
- \`DataTableContent\`
- \`DataTablePagination\`

## Props overview
- \`columns\`: TanStack column defs (supports \`meta\` for filter UI)
- \`data\`: array of rows
- \`selection\`: boolean to add checkbox column
- \`searchable\`, \`columnVisibility\`, \`columnPinning\`, \`columnOrdering\`, \`sorting\`
- \`density\`: 'default' | 'compact'
- \`filters\`: { columns?: string[] } to show Filters menu for listed columns
- \`pagination\`: { pageIndex, pageSize, pageCount?, onPageChange, onPageSizeChange?, pageSizeOptions? }
- \`loading\`: show skeletons

## Server-side usage (recommended)
- Infer query inputs via \`useDataTable\` in children and read \`table.getState()\` (globalFilter, columnFilters, sorting, pagination). Fetch rows and set \`pageCount\`.
- Provide controlled \`pagination\` (pageIndex, pageSize, pageCount, handlers).

Alternative: You can also pass \`onQueryChange\` to receive query inputs as a callback when they change.

React Query example:

\`\`\`tsx
function ReactQueryFetcher() {
  const { table } = useDataTable<Person>();
  const { globalFilter, columnFilters, sorting, pagination } = table.getState();
  const query = useQuery({
    queryKey: ['users', globalFilter, columnFilters, sorting, pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        gf: String(globalFilter ?? ''),
        pi: String(pagination.pageIndex),
        ps: String(pagination.pageSize),
      });
      const res = await fetch('/api/users?' + params.toString());
      return (await res.json()) as { rows: Person[]; total: number };
    },
    keepPreviousData: true,
  });

  useEffect(() => {
    // setRows(query.data?.rows ?? []) and setPageCount(...) in the parent; or lift state via props
  }, [query.data]);

  return null;
}
\`\`\`

Example:

\`\`\`tsx
const [pageIndex, setPageIndex] = useState(0);
const [pageSize, setPageSize] = useState(10);
const [loading, setLoading] = useState(false);
const [rows, setRows] = useState<Person[]>([]);
const [pageCount, setPageCount] = useState(0);

function ServerFetcher() {
  const { table } = useDataTable<Person>();
  const { globalFilter, columnFilters, sorting, pagination } = table.getState();

  useEffect(() => {
    setLoading(true);
    fetch('/api/users?gf=' + (globalFilter || '') + '&pi=' + pagination.pageIndex + '&ps=' + pagination.pageSize)
      .then((r) => r.json())
      .then(({ data, total }) => {
        setRows(data);
        setPageCount(Math.max(1, Math.ceil(total / pagination.pageSize)));
      })
      .finally(() => setLoading(false));
  }, [globalFilter, columnFilters, sorting, pagination.pageIndex, pagination.pageSize]);
  return null;
}

<DataTable
  columns={columns}
  data={rows}
  loading={loading}
  manualFiltering
  pagination={{ pageIndex, pageSize, pageCount, onPageChange: setPageIndex, onPageSizeChange: setPageSize }}
>
  <ServerFetcher />
  <DataTableToolbar>
    <div className="flex w-full items-center gap-2">
      <DataTableSearch />
      <DataTableFilters />
      <DataTableColumns />
    </div>
  </DataTableToolbar>
  <DataTableContent />
  <div className="mt-3">
    <DataTablePagination />
  </div>
</DataTable>
\`\`\`

## Column meta
- \`filterVariant\`: 'text' | 'number' | 'select'
- \`filterOptions\`: for 'select' [{ label, value }]
- \`enableHiding\`: toggle visibility menu item
- \`enableOrdering\`: enable drag-reorder
- \`enableHeaderMenu\`: show column kebab menu
- \`headerLabel\`: aria-label for header
`,
      },
    },
  },
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default',
  render: () => (
    <DataTable<Person> columns={columns} data={data} selection filters={{ columns: ['name', 'role', 'active'] }}>
      <DataTableToolbar>
        <div className="flex w-full items-center gap-2">
          <DataTableSearch />
          <DataTableFilters />
          <DataTableColumns />
        </div>
      </DataTableToolbar>
      <DataTableContent />
      <div className="mt-3">
        <DataTablePagination />
      </div>
    </DataTable>
  ),
};

export const Loading: Story = {
  name: 'Loading state',
  render: () => (
    <DataTable<Person> columns={columns} data={[]} loading>
      <DataTableToolbar>
        <div className="flex w-full items-center gap-2">
          <DataTableSearch />
          <DataTableFilters />
          <DataTableColumns />
        </div>
      </DataTableToolbar>
      <DataTableContent />
    </DataTable>
  ),
};

export const Compact: Story = {
  name: 'Density: compact',
  render: () => (
    <DataTable<Person>
      columns={columns}
      data={data}
      searchable={false}
      columnOrdering={false}
      columnPinning={false}
      columnVisibility={false}
      density="compact"
    >
      <DataTableContent />
      <div className="mt-3">
        <DataTablePagination />
      </div>
    </DataTable>
  ),
};

export const NoSearch: Story = {
  name: 'Search disabled',
  render: () => (
    <DataTable<Person> columns={columns} data={data} searchable={false}>
      <DataTableToolbar>
        <div className="flex w-full items-center gap-2">
          <DataTableFilters />
          <DataTableColumns />
        </div>
      </DataTableToolbar>
      <DataTableContent />
      <div className="mt-3">
        <DataTablePagination />
      </div>
    </DataTable>
  ),
};

export const WithSelection: Story = {
  name: 'With selection',
  render: () => (
    <DataTable<Person> columns={columns} data={data} selection>
      <DataTableToolbar>
        <div className="flex w-full items-center gap-2">
          <DataTableSearch />
          <DataTableFilters />
          <DataTableColumns />
        </div>
      </DataTableToolbar>
      <DataTableContent />
      <div className="mt-3">
        <DataTablePagination />
      </div>
    </DataTable>
  ),
};

export const ColumnControlsDisabled: Story = {
  name: 'No column pin/visibility/order',
  render: () => (
    <DataTable<Person>
      columns={columns}
      data={data}
      columnOrdering={false}
      columnPinning={false}
      columnVisibility={false}
    >
      <DataTableToolbar>
        <div className="flex w-full items-center gap-2">
          <DataTableSearch />
          <DataTableFilters />
        </div>
      </DataTableToolbar>
      <DataTableContent />
      <div className="mt-3">
        <DataTablePagination />
      </div>
    </DataTable>
  ),
};

export const ControlledPagination: Story = {
  name: 'Controlled pagination (server data)',
  render: () => {
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState<{ globalFilter: string; columnFilters: unknown[]; sorting: unknown[] }>({
      globalFilter: '',
      columnFilters: [],
      sorting: [],
    });

    // Simulated server: compute paged data + total on the fly
    const filtered = useMemo(() => {
      let rows = data;
      const gf = query.globalFilter?.toLowerCase?.() ?? '';
      if (gf) rows = rows.filter((r) => String(r.name).toLowerCase().includes(gf));
      return rows;
    }, [query]);
    const pageCount = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
    const pageData = useMemo(() => {
      const start = pageIndex * pageSize;
      return filtered.slice(start, start + pageSize);
    }, [filtered, pageIndex, pageSize]);

    useEffect(() => {
      setLoading(true);
      const t = setTimeout(() => setLoading(false), 250);
      return () => clearTimeout(t);
    }, [pageIndex, pageSize]);

    return (
      <DataTable<Person>
        columns={columns}
        data={pageData}
        loading={loading}
        manualFiltering
        onQueryChange={(q) =>
          setQuery({
            globalFilter: q.globalFilter,
            columnFilters: q.columnFilters as unknown[],
            sorting: q.sorting as unknown[],
          })
        }
        pagination={{
          pageIndex,
          pageSize,
          pageCount,
          onPageChange: setPageIndex,
          onPageSizeChange: setPageSize,
          pageSizeOptions: [5, 10, 25, 50],
        }}
      >
        <DataTableToolbar>
          <div className="flex w-full items-center gap-2">
            <DataTableSearch />
            <DataTableFilters />
            <DataTableColumns />
          </div>
        </DataTableToolbar>
        <DataTableContent />
        <div className="mt-3">
          <DataTablePagination />
        </div>
      </DataTable>
    );
  },
};

export const ServerInferQueryWithHook: Story = {
  name: 'Server (infer query via hook)',
  render: () => {
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<Person[]>([]);
    const [pageCount, setPageCount] = useState(0);

    // Basic client-side simulation of a server fetch using the live table state
    function ServerFetcher() {
      const { table } = useDataTable<Person>();
      const { globalFilter, columnFilters, sorting } = table.getState();

      useEffect(() => {
        setLoading(true);
        const t = setTimeout(() => {
          // simulate server logic using base data + current table state
          let result = data;
          const gf = (globalFilter as string)?.toLowerCase?.() ?? '';
          if (gf) result = result.filter((r) => String(r.name).toLowerCase().includes(gf));
          // columnFilters/sorting are available here for real server usage
          setRows(result.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize));
          setPageCount(Math.max(1, Math.ceil(result.length / pageSize)));
          setLoading(false);
        }, 200);
        return () => clearTimeout(t);
      }, [globalFilter, columnFilters, sorting, pageIndex, pageSize]);

      return null;
    }

    return (
      <DataTable<Person>
        columns={columns}
        data={rows}
        loading={loading}
        manualFiltering
        pagination={{
          pageIndex,
          pageSize,
          pageCount,
          onPageChange: setPageIndex,
          onPageSizeChange: setPageSize,
          pageSizeOptions: [5, 10, 25, 50],
        }}
      >
        <ServerFetcher />
        <DataTableToolbar>
          <div className="flex w-full items-center gap-2">
            <DataTableSearch />
            <DataTableFilters />
            <DataTableColumns />
          </div>
        </DataTableToolbar>
        <DataTableContent />
        <div className="mt-3">
          <DataTablePagination />
        </div>
      </DataTable>
    );
  },
};

export const WithFiltersConfigured: Story = {
  name: 'Filters configured',
  render: () => (
    <DataTable<Person> columns={columns} data={data} filters={{ columns: ['name', 'role', 'active'] }}>
      <DataTableToolbar>
        <div className="flex w-full items-center gap-2">
          <DataTableSearch />
          <DataTableFilters />
          <DataTableColumns />
        </div>
      </DataTableToolbar>
      <DataTableContent />
      <div className="mt-3">
        <DataTablePagination />
      </div>
    </DataTable>
  ),
};

export const InCard: Story = {
  name: 'In Card layout',
  render: () => (
    <Card className="max-w-5xl w-full">
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>A table of users with filters and actions</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable<Person> columns={columns} data={data} selection filters={{ columns: ['name', 'role', 'active'] }}>
          <DataTableToolbar>
            <div className="flex w-full items-center gap-2">
              <DataTableSearch />
              <DataTableFilters />
              <DataTableColumns />
            </div>
          </DataTableToolbar>
          <DataTableContent />
          <div className="mt-3">
            <DataTablePagination />
          </div>
        </DataTable>
      </CardContent>
    </Card>
  ),
};

export const Composable: Story = {
  name: 'Composable (custom toolbar and layout)',
  render: () => (
    <Card className="max-w-5xl w-full">
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Custom toolbar composition using subcomponents</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <DataTable<Person> columns={columns} data={data} selection filters={{ columns: ['name', 'role'] }}>
          <DataTableToolbar>
            <div className="flex w-full items-center gap-2 px-6">
              <DataTableSearch />
              <DataTableFilters />
              <DataTableColumns />
            </div>
          </DataTableToolbar>
          <DataTableContent />
          <div className="mt-3 px-6">
            <DataTablePagination />
          </div>
        </DataTable>
      </CardContent>
    </Card>
  ),
};

export const WithBulkDelete: Story = {
  name: 'With bulk actions (dropdown + confirm)',
  render: () => {
    const [rows, setRows] = useState<Person[]>(data);

    function BulkActions({ onDelete }: { onDelete: (ids: string[]) => void }) {
      const { table } = useDataTable<Person>();
      const selected = table.getSelectedRowModel().flatRows;
      const count = selected.length;
      const selectedIds = selected.map((r) => (r.original as Person).id);
      const [open, setOpen] = useState(false);

      return (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>Bulk actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={count === 0} onSelect={() => setOpen(true)}>
                Delete selected ({count})
              </DropdownMenuItem>
              <DropdownMenuItem disabled={count === 0} onSelect={(e) => e.preventDefault()}>
                Export selected
              </DropdownMenuItem>
              <DropdownMenuItem disabled={count === 0} onSelect={(e) => e.preventDefault()}>
                Mark as active
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={count === 0} onSelect={() => table.resetRowSelection()}>
                Clear selection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Delete {count} {count === 1 ? 'user' : 'users'}?
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. The selected {count === 1 ? 'user will' : 'users will'} be permanently
                  removed.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onDelete(selectedIds);
                      table.resetRowSelection();
                      setOpen(false);
                    }}
                  >
                    Confirm delete
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      );
    }

    return (
      <DataTable<Person> columns={columns} data={rows} selection>
        <DataTableToolbar>
          <div className="flex w-full items-center gap-2">
            <DataTableSearch />
            <DataTableFilters />
            <DataTableColumns />
            <div className="ml-auto">
              <BulkActions onDelete={(ids) => setRows((prev) => prev.filter((u) => !ids.includes(u.id)))} />
            </div>
          </div>
        </DataTableToolbar>
        <DataTableContent />
        <div className="mt-3">
          <DataTablePagination />
        </div>
      </DataTable>
    );
  },
};
