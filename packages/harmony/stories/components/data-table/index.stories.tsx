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
} from '@/components/ui/data-table';
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

    const pageCount = useMemo(() => Math.ceil(data.length / pageSize), [pageSize]);
    const pageData = useMemo(() => {
      const start = pageIndex * pageSize;
      return data.slice(start, start + pageSize);
    }, [pageIndex, pageSize]);

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
