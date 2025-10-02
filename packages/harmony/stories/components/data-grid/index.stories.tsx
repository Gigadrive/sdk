import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataGrid, DataGridContainer, type DataGridProps } from '@/components/ui/data-grid';
import { DataGridColumnFilter } from '@/components/ui/data-grid-column-filter';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridColumnVisibility } from '@/components/ui/data-grid-column-visibility';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable, DataGridTableRowSelect, DataGridTableRowSelectAll } from '@/components/ui/data-grid-table';
import { DataGridTableDnd } from '@/components/ui/data-grid-table-dnd';
import { DataGridTableDndRowHandle, DataGridTableDndRows } from '@/components/ui/data-grid-table-dnd-rows';

import { DragEndEvent } from '@dnd-kit/core';
import {
  ColumnDef,
  ExpandedState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  createColumnHelper,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Calendar, Mail, Shield, User, Users } from 'lucide-react';

type Person = {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
};

const STATUSES: Person['status'][] = ['active', 'inactive', 'pending'];
const ROLES: Person['role'][] = ['admin', 'editor', 'viewer'];

function generatePeople(count = 42): Person[] {
  const people: Person[] = [];
  for (let i = 1; i <= count; i++) {
    const status = STATUSES[i % STATUSES.length];
    const role = ROLES[i % ROLES.length];
    const date = new Date();
    date.setDate(date.getDate() - i);
    people.push({
      id: `${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      status,
      role,
      createdAt: date.toISOString(),
    });
  }
  return people;
}

const columnHelper = createColumnHelper<Person>();

function useDemoColumns(opts?: {
  withSelection?: boolean;
  withIcons?: boolean;
  withFilters?: boolean;
  enableResize?: boolean;
  enablePin?: boolean;
  visibilityControlInHeader?: boolean;
  expandedContent?: boolean;
  showRowHandle?: boolean;
}) {
  const {
    withSelection,
    withIcons,
    withFilters,
    enableResize,
    enablePin,
    visibilityControlInHeader,
    expandedContent,
    showRowHandle,
  } = opts || {};

  const columns = useMemo<ColumnDef<Person, unknown>[]>(() => {
    const cols: ColumnDef<Person, unknown>[] = [];

    if (withSelection) {
      cols.push({
        id: 'select',
        enableHiding: false,
        size: 42,
        header: () => <DataGridTableRowSelectAll size="sm" />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} size="sm" />,
      });
    }

    if (showRowHandle) {
      cols.push({
        id: 'handle',
        enableSorting: false,
        enableHiding: false,
        size: 48,
        header: () => null,
        cell: ({ row }) => <DataGridTableDndRowHandle rowId={row.id} />,
      });
    }

    cols.push(
      columnHelper.accessor('name', {
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title="Name"
            icon={withIcons ? <User className="size-3.5" /> : undefined}
            visibility={visibilityControlInHeader}
          />
        ),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
        size: enableResize ? 180 : undefined,
        meta: {
          headerTitle: 'Name',
          skeleton: <div className="h-4 w-24 bg-muted rounded" />,
          expandedContent: expandedContent
            ? (row: Person) => (
                <div className="p-4 text-sm grid gap-1">
                  <div className="font-medium">Details for {row.name}</div>
                  <div>Email: {row.email}</div>
                  <div>Role: {row.role}</div>
                  <div>Status: {row.status}</div>
                </div>
              )
            : undefined,
        },
      }) as ColumnDef<Person, unknown>,
      columnHelper.accessor('email', {
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title="Email"
            icon={withIcons ? <Mail className="size-3.5" /> : undefined}
          />
        ),
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
        size: enableResize ? 240 : undefined,
        meta: { headerTitle: 'Email', skeleton: <div className="h-4 w-40 bg-muted rounded" /> },
      }) as ColumnDef<Person, unknown>,
      columnHelper.accessor('status', {
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title="Status"
            icon={withIcons ? <Users className="size-3.5" /> : undefined}
            filter={
              withFilters ? (
                <DataGridColumnFilter
                  column={column}
                  title="Status"
                  options={STATUSES.map((s) => ({ label: s, value: s }))}
                />
              ) : undefined
            }
          />
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          const variant: 'default' | 'secondary' | 'outline' =
            value === 'active' ? 'default' : value === 'pending' ? 'secondary' : 'outline';
          return <Badge variant={variant}>{value}</Badge>;
        },
        size: enableResize ? 140 : undefined,
        meta: { headerTitle: 'Status', skeleton: <div className="h-4 w-16 bg-muted rounded" /> },
      }) as ColumnDef<Person, unknown>,
      columnHelper.accessor('role', {
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title="Role"
            icon={withIcons ? <Shield className="size-3.5" /> : undefined}
            filter={
              withFilters ? (
                <DataGridColumnFilter
                  column={column}
                  title="Role"
                  options={ROLES.map((r) => ({ label: r, value: r }))}
                />
              ) : undefined
            }
          />
        ),
        cell: ({ getValue }) => <span>{getValue()}</span>,
        size: enableResize ? 140 : undefined,
        meta: { headerTitle: 'Role', skeleton: <div className="h-4 w-16 bg-muted rounded" /> },
      }) as ColumnDef<Person, unknown>,
      columnHelper.accessor('createdAt', {
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title="Created"
            icon={withIcons ? <Calendar className="size-3.5" /> : undefined}
          />
        ),
        cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
        size: enableResize ? 160 : undefined,
        meta: { headerTitle: 'Created', skeleton: <div className="h-4 w-24 bg-muted rounded" /> },
      }) as ColumnDef<Person, unknown>
    );

    if (enablePin) {
      cols.forEach((c) => {
        // allow pinning on all non-utility columns
        if (c.id !== 'select' && c.id !== 'handle') {
          c.enablePinning = true;
        }
      });
    }

    return cols;
  }, [
    withSelection,
    withIcons,
    withFilters,
    enableResize,
    enablePin,
    visibilityControlInHeader,
    expandedContent,
    showRowHandle,
  ]);

  return columns;
}

function useDemoTable(
  data: Person[],
  columns: ColumnDef<Person, unknown>[],
  options?: {
    enableRowSelection?: boolean;
    enableColumnResizing?: boolean;
    enablePinning?: boolean;
  }
) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection, expanded, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableRowSelection: options?.enableRowSelection ?? false,
    enableColumnResizing: options?.enableColumnResizing,
    columnResizeMode: 'onChange',
    enablePinning: options?.enablePinning,
  });

  return table;
}

const meta = {
  title: 'Components/DataGrid',
  component: DataGridContainer,
  args: { children: null as unknown as ReactNode },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A powerful data grid built on TanStack Table v8. Stories mirror examples from ReUI docs.' +
          '\n\nDocs: https://reui.io/docs/data-grid.md',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DataGridContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

function GridShell(props: {
  tableProps: Omit<DataGridProps<Person>, 'table' | 'recordCount'> & {
    tableLayout?: DataGridProps<Person>['tableLayout'];
  };
  tableVariant: 'base' | 'dnd-columns' | 'dnd-rows';
  table: ReturnType<typeof useDemoTable>;
  data: Person[];
  setData?: (updater: Person[] | ((prev: Person[]) => Person[])) => void;
  children?: ReactNode;
}) {
  const { tableVariant, table, data, setData } = props;
  const common = (
    <>
      {tableVariant === 'dnd-columns' ? (
        <DataGridTableDnd
          handleDragEnd={(event: DragEndEvent) => {
            const { active, over } = event;
            if (!over) return;
            if (active.id !== over.id) {
              const columnOrder = table.getState().columnOrder;
              const oldIndex = columnOrder.indexOf(active.id as string);
              const newIndex = columnOrder.indexOf(over.id as string);
              const newOrder = [...columnOrder];
              newOrder.splice(oldIndex, 1);
              newOrder.splice(newIndex, 0, active.id as string);
              table.setColumnOrder(newOrder);
            }
          }}
        />
      ) : tableVariant === 'dnd-rows' && setData ? (
        <DataGridTableDndRows
          dataIds={table.getRowModel().rows.map((r) => r.id)}
          handleDragEnd={(event: DragEndEvent) => {
            const { active, over } = event;
            if (!over) return;
            if (active.id !== over.id) {
              setData((prev) => {
                const oldIndex = prev.findIndex((p) => p.id === active.id);
                const newIndex = prev.findIndex((p) => p.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return prev;
                const next = [...prev];
                const [moved] = next.splice(oldIndex, 1);
                next.splice(newIndex, 0, moved);
                return next;
              });
            }
          }}
        />
      ) : (
        <DataGridTable />
      )}

      <div className="border-t border-border">
        <DataGridPagination more moreLimit={5} />
      </div>
    </>
  );

  return (
    <DataGrid<Person> table={table} recordCount={data.length} {...props.tableProps}>
      <DataGridContainer>
        {props.children}
        {common}
      </DataGridContainer>
    </DataGrid>
  );
}

export const Basic: Story = {
  render: () => {
    const data = generatePeople(36);
    const columns = useDemoColumns({ withIcons: true, withFilters: true });
    const table = useDemoTable(data, columns);

    return (
      <GridShell tableProps={{ tableLayout: { rowBorder: true } }} tableVariant="base" table={table} data={data}>
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Basic data grid</div>
        </div>
      </GridShell>
    );
  },
};

export const DenseAndBorders: Story = {
  render: () => {
    const data = generatePeople(24);
    const columns = useDemoColumns({ withFilters: true });
    const table = useDemoTable(data, columns);

    return (
      <GridShell
        tableProps={{
          tableLayout: { dense: true, cellBorder: true, rowBorder: true },
        }}
        tableVariant="base"
        table={table}
        data={data}
      >
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Dense layout with cell and row borders</div>
        </div>
      </GridShell>
    );
  },
};

export const StripedAndAutoWidth: Story = {
  render: () => {
    const data = generatePeople(30);
    const columns = useDemoColumns();
    const table = useDemoTable(data, columns);

    return (
      <GridShell
        tableProps={{
          tableLayout: { stripped: true, rowBorder: false, width: 'auto' },
        }}
        tableVariant="base"
        table={table}
        data={data}
      >
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Striped rows and auto width</div>
        </div>
      </GridShell>
    );
  },
};

export const StickyHeader: Story = {
  render: () => {
    const data = generatePeople(60);
    const columns = useDemoColumns({ withFilters: true });
    const table = useDemoTable(data, columns);
    return (
      <div style={{ height: 360, overflow: 'auto' }}>
        <GridShell
          tableProps={{ tableLayout: { headerSticky: true, rowBorder: true } }}
          tableVariant="base"
          table={table}
          data={data}
        >
          <div className="flex items-center justify-between p-3">
            <div className="text-sm text-muted-foreground">Sticky header</div>
          </div>
        </GridShell>
      </div>
    );
  },
};

export const ColumnControlsAndVisibility: Story = {
  render: () => {
    const data = generatePeople(28);
    const columns = useDemoColumns({ withFilters: true, withIcons: true, visibilityControlInHeader: true });
    const table = useDemoTable(data, columns);
    return (
      <GridShell
        tableProps={{ tableLayout: { columnsVisibility: true, columnsMovable: true, rowBorder: true } }}
        tableVariant="base"
        table={table}
        data={data}
      >
        <div className="flex items-center justify-between p-3 gap-2">
          <div className="text-sm text-muted-foreground">Column controls via header menu</div>
          <DataGridColumnVisibility
            table={table}
            trigger={
              <Button variant="outline" size="sm">
                Columns
              </Button>
            }
          />
        </div>
      </GridShell>
    );
  },
};

export const ResizableAndPinnable: Story = {
  render: () => {
    const data = generatePeople(32);
    const columns = useDemoColumns({ enableResize: true, enablePin: true, withFilters: true });
    const table = useDemoTable(data, columns, { enableColumnResizing: true, enablePinning: true });
    return (
      <GridShell
        tableProps={{ tableLayout: { columnsResizable: true, columnsPinnable: true, rowBorder: true } }}
        tableVariant="base"
        table={table}
        data={data}
      >
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Resizable columns with pinning</div>
        </div>
      </GridShell>
    );
  },
};

export const MovableColumns: Story = {
  render: () => {
    const data = generatePeople(26);
    const columns = useDemoColumns({ withIcons: true });
    const table = useDemoTable(data, columns);
    return (
      <GridShell
        tableProps={{ tableLayout: { columnsMovable: true, rowBorder: true } }}
        tableVariant="base"
        table={table}
        data={data}
      >
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Move columns left or right from header menu</div>
        </div>
      </GridShell>
    );
  },
};

export const DraggableColumns: Story = {
  render: () => {
    const data = generatePeople(24);
    const columns = useDemoColumns({ withIcons: true });
    const table = useDemoTable(data, columns);
    return (
      <GridShell
        tableProps={{ tableLayout: { columnsDraggable: true, rowBorder: true } }}
        tableVariant="dnd-columns"
        table={table}
        data={data}
      >
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Drag columns to reorder</div>
        </div>
      </GridShell>
    );
  },
};

export const DraggableRows: Story = {
  render: () => {
    const [data, setData] = useState<Person[]>(() => generatePeople(18));
    const columns = useDemoColumns({ showRowHandle: true });
    const table = useDemoTable(data, columns);
    return (
      <GridShell
        tableProps={{ tableLayout: { rowsDraggable: true, rowBorder: true } }}
        tableVariant="dnd-rows"
        table={table}
        data={data}
        setData={setData}
      >
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Drag rows using the handle</div>
        </div>
      </GridShell>
    );
  },
};

export const RowSelection: Story = {
  render: () => {
    const data = generatePeople(22);
    const columns = useDemoColumns({ withSelection: true });
    const table = useDemoTable(data, columns, { enableRowSelection: true });
    return (
      <GridShell tableProps={{ tableLayout: { rowBorder: true } }} tableVariant="base" table={table} data={data}>
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Row selection with checkbox column</div>
          <div className="text-xs text-muted-foreground">
            Selected: {Object.keys(table.getState().rowSelection).length}
          </div>
        </div>
      </GridShell>
    );
  },
};

export const ExpandableRows: Story = {
  render: () => {
    const data = generatePeople(20);
    const columns = useDemoColumns({ expandedContent: true });
    const table = useDemoTable(data, columns);
    // Enable expanding on all rows via a simple click on the row
    table.getRowModel().rows.forEach((r) => (r.getCanExpand = () => true));
    return (
      <GridShell tableProps={{ tableLayout: { rowBorder: true } }} tableVariant="base" table={table} data={data}>
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Rows expand to show custom content</div>
        </div>
      </GridShell>
    );
  },
};

export const LoadingSkeleton: Story = {
  render: () => {
    const data = generatePeople(25);
    const columns = useDemoColumns({ withIcons: true });
    const table = useDemoTable(data, columns);
    return (
      <GridShell
        tableProps={{ isLoading: true, loadingMode: 'skeleton', tableLayout: { rowBorder: true } }}
        tableVariant="base"
        table={table}
        data={data}
      >
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Skeleton loading</div>
        </div>
      </GridShell>
    );
  },
};

export const EmptyState: Story = {
  render: () => {
    const data: Person[] = [];
    const columns = useDemoColumns();
    const table = useDemoTable(data, columns);
    return (
      <GridShell
        tableProps={{ tableLayout: { rowBorder: true }, emptyMessage: 'No data available' }}
        tableVariant="base"
        table={table}
        data={data}
      >
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-muted-foreground">Empty state</div>
        </div>
      </GridShell>
    );
  },
};
