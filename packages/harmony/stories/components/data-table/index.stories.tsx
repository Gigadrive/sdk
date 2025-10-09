import type { Meta, StoryObj } from '@storybook/react';

import { DataTable, DataTableColumn } from '@/components/ui/data-table';
import { Badge } from '../../../src/components/ui/badge';
import { useDataTable } from '../../../src/hooks/use-data-table';

const meta = {
  title: 'Components/Data Table',
  component: DataTable,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
}

async function fetchUsers({
  pagination,
  sorting,
}: {
  pagination: { pageIndex: number; pageSize: number };
  sorting: { id: string; direction: 'asc' | 'desc' } | null;
}) {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Generate mock data
  const allUsers: User[] = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: ['Admin', 'Editor', 'Viewer'][i % 3],
    status: i % 3 === 0 ? 'inactive' : 'active',
  }));

  // Apply sorting
  const sortedUsers = [...allUsers];
  if (sorting) {
    sortedUsers.sort((a, b) => {
      const aValue = a[sorting.id as keyof User];
      const bValue = b[sorting.id as keyof User];

      if (aValue < bValue) return sorting.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sorting.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Apply pagination
  const start = pagination.pageIndex * pagination.pageSize;
  const end = start + pagination.pageSize;
  const paginatedUsers = sortedUsers.slice(start, end);

  return {
    data: paginatedUsers,
    totalRows: allUsers.length,
  };
}

export const Default: Story = {
  args: {
    columns: [
      { id: 'col1', header: 'Column 1' },
      { id: 'col2', header: 'Column 2' },
    ],
    data: [],
  },
  parameters: {
    docs: {
      description: {
        story: 'A minimal DataTable with two columns and no rows.',
      },
    },
  },
  render: () => {
    const table = useDataTable<User>({
      fetchData: fetchUsers,
      initialPagination: { pageIndex: 0, pageSize: 10 },
    });

    const columns: DataTableColumn<User>[] = [
      {
        id: 'id',
        header: 'ID',
        accessorKey: 'id',
        sortable: true,
        width: 'w-20',
      },
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        sortable: true,
      },
      {
        id: 'email',
        header: 'Email',
        accessorKey: 'email',
        sortable: true,
      },
      {
        id: 'role',
        header: 'Role',
        accessorKey: 'role',
        sortable: true,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: (row) => <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status}</Badge>,
        sortable: true,
      },
    ];

    return (
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Basic Example</h1>
            <p className="text-muted-foreground mt-2">Simple data table with server-side pagination and sorting</p>
          </div>

          <DataTable
            columns={columns}
            data={table.data}
            pagination={table.pagination}
            onPaginationChange={table.setPagination}
            sorting={table.sorting}
            onSortingChange={table.setSorting}
            totalRows={table.totalRows}
            isLoading={table.isLoading}
            enablePageSizeSelector
          />
        </div>
      </div>
    );
  },
};
