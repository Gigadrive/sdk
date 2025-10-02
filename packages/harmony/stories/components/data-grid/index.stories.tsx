import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataGrid, DataGridContainer } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable, DataGridTableRowSelect, DataGridTableRowSelectAll } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { Meta, StoryObj } from '@storybook/react';
import {
  ColumnDef,
  ColumnOrderState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  RowSelectionState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface IData {
  id: string;
  name: string;
  availability: 'online' | 'away' | 'busy' | 'offline';
  avatar: string;
  status: 'active' | 'inactive';
  flag: string; // Emoji flags
  email: string;
  company: string;
  role: string;
  joined: string;
  location: string;
  balance: number;
  details: string;
}

const demoData: IData[] = [
  {
    id: '1',
    name: 'Kathryn Campbell',
    availability: 'online',
    avatar: '1.png',
    status: 'active',
    flag: '🇺🇸',
    email: 'kathryn@apple.com',
    company: 'Apple',
    role: 'CEO',
    joined: '2021-04-15',
    location: 'San Francisco, USA',
    balance: 5143.03,
    details: 'Kathryn is a visionary leader at Apple, focusing on innovation and team growth.',
  },
  {
    id: '2',
    name: 'Robert Smith',
    availability: 'away',
    avatar: '2.png',
    status: 'inactive',
    flag: '🇬🇧',
    email: 'robert@openai.com',
    company: 'OpenAI',
    role: 'CTO',
    joined: '2020-07-20',
    location: 'London, UK',
    balance: 4321.87,
    details: 'Robert is a technology pioneer specializing in artificial intelligence and machine learning.',
  },
  {
    id: '3',
    name: 'Sophia Johnson',
    availability: 'busy',
    avatar: '3.png',
    status: 'active',
    flag: '🇨🇦',
    email: 'sophia@meta.com',
    company: 'Meta',
    role: 'Designer',
    joined: '2019-03-12',
    location: 'Toronto, Canada',
    balance: 7654.98,
    details: 'Sophia is a creative designer passionate about building user-centric experiences.',
  },
  {
    id: '4',
    name: 'Lucas Walker',
    availability: 'offline',
    avatar: '4.png',
    status: 'inactive',
    flag: '🇦🇺',
    email: 'lucas@tesla.com',
    company: 'Tesla',
    role: 'Developer',
    joined: '2022-01-18',
    location: 'Sydney, Australia',
    balance: 3456.45,
    details: 'Lucas is a talented developer focused on innovative solutions in automotive technology.',
  },
  {
    id: '5',
    name: 'Emily Davis',
    availability: 'online',
    avatar: '5.png',
    status: 'active',
    flag: '🇩🇪',
    email: 'emily@sap.com',
    company: 'SAP',
    role: 'Lawyer',
    joined: '2023-05-23',
    location: 'Berlin, Germany',
    balance: 9876.54,
    details: 'Emily is a corporate lawyer specializing in technology and software agreements.',
  },
  {
    id: '6',
    name: 'James Lee',
    availability: 'away',
    avatar: '6.png',
    status: 'active',
    flag: '🇲🇾',
    email: 'james@keenthemes.com',
    company: 'Keenthemes',
    role: 'Director',
    joined: '2018-11-30',
    location: 'Kuala Lumpur, MY',
    balance: 6214.22,
    details: 'James oversees product development and team leadership at Keenthemes.',
  },
  {
    id: '7',
    name: 'Isabella Martinez',
    availability: 'busy',
    avatar: '7.png',
    status: 'inactive',
    flag: '🇪🇸',
    email: 'isabella@bbva.es',
    company: 'BBVA',
    role: 'Product Manager',
    joined: '2021-06-14',
    location: 'Barcelona, Spain',
    balance: 5321.77,
    details: 'Isabella manages product development and strategy for BBVA’s digital platforms.',
  },
  {
    id: '8',
    name: 'Benjamin Harris',
    availability: 'offline',
    avatar: '8.png',
    status: 'active',
    flag: '🇯🇵',
    email: 'benjamin@sony.jp',
    company: 'Sony',
    role: 'Marketing Lead',
    joined: '2020-10-22',
    location: 'Tokyo, Japan',
    balance: 8452.39,
    details: 'Benjamin leads innovative marketing campaigns for Sony’s flagship products.',
  },
  {
    id: '9',
    name: 'Olivia Brown',
    availability: 'online',
    avatar: '9.png',
    status: 'active',
    flag: '🇫🇷',
    email: 'olivia@lvmh.fr',
    company: 'LVMH',
    role: 'Data Scientist',
    joined: '2019-09-17',
    location: 'Paris, France',
    balance: 7345.1,
    details: 'Olivia is a data scientist optimizing sales and marketing analytics at LVMH.',
  },
  {
    id: '10',
    name: 'Michael Clark',
    availability: 'away',
    avatar: '10.png',
    status: 'inactive',
    flag: '🇮🇹',
    email: 'michael@eni.it',
    company: 'ENI',
    role: 'Engineer',
    joined: '2023-02-11',
    location: 'Milan, Italy',
    balance: 5214.88,
    details: 'Michael is a lead engineer developing sustainable energy solutions at ENI.',
  },
  {
    id: '11',
    name: 'Ava Wilson',
    availability: 'busy',
    avatar: '11.png',
    status: 'active',
    flag: '🇧🇷',
    email: 'ava@vale.br',
    company: 'Vale',
    role: 'Software Engineer',
    joined: '2022-12-01',
    location: 'Rio de Janeiro, Brazil',
    balance: 9421.5,
    details: 'Ava develops cutting-edge software to optimize mining operations at Vale.',
  },
  {
    id: '12',
    name: 'David Young',
    availability: 'offline',
    avatar: '12.png',
    status: 'active',
    flag: '🇮🇳',
    email: 'david@tata.in',
    company: 'Tata',
    role: 'Sales Manager',
    joined: '2020-03-27',
    location: 'Mumbai, India',
    balance: 4521.67,
    details: 'David manages international sales for Tata’s industrial and automotive products.',
  },
];

const meta = {
  title: 'Components/Data Grid',
  tags: ['autodocs'],
} satisfies Meta<typeof DataGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CellBorder: Story = {
  render: () => {
    const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 5,
    });
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: true }]);
    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
    const columns = useMemo<ColumnDef<IData>[]>(
      () => [
        {
          accessorKey: 'name',
          id: 'name',
          header: 'Name',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-3">
                <Avatar className="size-8">
                  <AvatarImage src={`/media/avatars/${row.original.avatar}`} alt={row.original.name} />
                  <AvatarFallback>N</AvatarFallback>
                </Avatar>
                <div className="space-y-px">
                  <div className="font-medium text-foreground">{row.original.name}</div>
                  <div className="text-muted-foreground">{row.original.email}</div>
                </div>
              </div>
            );
          },
          size: 250,
          enableSorting: true,
          enableHiding: false,
        },
        {
          accessorKey: 'company',
          header: 'Company',
          cell: (info) => <span>{info.getValue() as string}</span>,
          size: 150,
          meta: {
            headerClassName: '',
          },
        },
        {
          accessorKey: 'role',
          header: 'Occupation',
          cell: (info) => <span>{info.getValue() as string}</span>,
          size: 125,
          meta: {
            headerClassName: '',
          },
        },
        {
          accessorKey: 'balance',
          header: 'Salary',
          cell: (info) => <span className="font-semibold">${(info.getValue() as number).toFixed(2)}</span>,
          size: 120,
        },
      ],
      []
    );
    const table = useReactTable({
      columns,
      data: demoData,
      pageCount: Math.ceil((demoData?.length || 0) / pagination.pageSize),
      getRowId: (row: IData) => row.id,
      state: {
        pagination,
        sorting,
        columnOrder,
      },
      onPaginationChange: setPagination,
      onSortingChange: setSorting,
      onColumnOrderChange: setColumnOrder,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });
    return (
      <DataGrid
        table={table}
        recordCount={demoData?.length || 0}
        tableLayout={{
          cellBorder: true,
        }}
      >
        <div className="w-full space-y-2.5">
          <DataGridContainer>
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DataGridContainer>
          <DataGridPagination />
        </div>
      </DataGrid>
    );
  },
};

export const DenseTable: Story = {
  render: () => {
    const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 5,
    });
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: true }]);
    const columns = useMemo<ColumnDef<IData>[]>(
      () => [
        {
          accessorKey: 'name',
          id: 'name',
          header: 'Name',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarImage src={`/media/avatars/${row.original.avatar}`} alt={row.original.name} />
                  <AvatarFallback>N</AvatarFallback>
                </Avatar>
                <a href="#" className="font-medium text-foreground hover:text-primary">
                  {row.original.name}
                </a>
              </div>
            );
          },
          size: 175,
          enableSorting: true,
          enableHiding: false,
        },
        {
          accessorKey: 'email',
          header: 'Email',
          cell: (info) => (
            <a href={`mailto:${info.getValue()}`} className="hover:text-primary hover:underline">
              {info.getValue() as string}
            </a>
          ),
          size: 175,
          meta: {
            headerClassName: '',
          },
        },
        {
          accessorKey: 'location',
          header: 'Location',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-1.5">
                {row.original.flag}
                <div className="font-medium text-foreground">{row.original.location}</div>
              </div>
            );
          },
          size: 175,
          meta: {
            headerClassName: '',
            cellClassName: 'text-start',
          },
        },
        {
          accessorKey: 'balance',
          header: 'Balance ($)',
          cell: (info) => <span className="font-semibold">${(info.getValue() as number).toFixed(2)}</span>,
          size: 125,
          meta: {
            headerClassName: 'text-right rtl:text-left',
            cellClassName: 'text-right rtl:text-left',
          },
        },
      ],
      []
    );
    const table = useReactTable({
      columns,
      data: demoData,
      pageCount: Math.ceil((demoData?.length || 0) / pagination.pageSize),
      getRowId: (row: IData) => row.id,
      state: {
        pagination,
        sorting,
      },
      onPaginationChange: setPagination,
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });
    return (
      <DataGrid table={table} recordCount={demoData?.length || 0} tableLayout={{ dense: true }}>
        <div className="w-full space-y-2.5">
          <DataGridContainer>
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DataGridContainer>
          <DataGridPagination />
        </div>
      </DataGrid>
    );
  },
};

export const Light: Story = {
  render: () => {
    const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 5,
    });
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: true }]);
    const columns = useMemo<ColumnDef<IData>[]>(
      () => [
        {
          accessorKey: 'name',
          id: 'name',
          header: 'Name',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-3">
                <Avatar className="size-8">
                  <AvatarImage src={`/media/avatars/${row.original.avatar}`} alt={row.original.name} />
                  <AvatarFallback>N</AvatarFallback>
                </Avatar>
                <div className="space-y-px">
                  <div className="font-medium text-foreground">{row.original.name}</div>
                  <div className="text-muted-foreground">{row.original.email}</div>
                </div>
              </div>
            );
          },
          size: 225,
          enableSorting: true,
          enableHiding: false,
        },
        {
          accessorKey: 'company',
          id: 'company',
          header: 'Role',
          cell: ({ row }) => {
            return (
              <div className="space-y-0.5">
                <div className="font-medium text-foreground">{row.original.role}</div>
                <div className="text-muted-foreground">{row.original.company}</div>
              </div>
            );
          },
          size: 150,
          enableSorting: true,
          enableHiding: false,
        },
        {
          accessorKey: 'location',
          header: 'Location',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-1.5">
                {row.original.flag}
                <div className="font-medium text-foreground">{row.original.location}</div>
              </div>
            );
          },
          size: 160,
          meta: {
            headerClassName: '',
            cellClassName: 'text-start',
          },
        },
        {
          accessorKey: 'status',
          id: 'status',
          header: 'Status',
          cell: ({ row }) => {
            const status = row.original.status;
            if (status == 'active') {
              return <Badge variant="default">Approved</Badge>;
            } else {
              return <Badge variant="destructive">Pending</Badge>;
            }
          },
          size: 100,
        },
      ],
      []
    );
    const table = useReactTable({
      columns,
      data: demoData,
      pageCount: Math.ceil((demoData?.length || 0) / pagination.pageSize),
      getRowId: (row: IData) => row.id,
      state: {
        pagination,
        sorting,
      },
      onPaginationChange: setPagination,
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });
    return (
      <DataGrid
        table={table}
        recordCount={demoData?.length || 0}
        tableLayout={{
          headerBackground: false,
          rowBorder: false,
          rowRounded: true,
        }}
      >
        <div className="w-full space-y-2.5">
          <DataGridContainer border={false}>
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DataGridContainer>
          <DataGridPagination />
        </div>
      </DataGrid>
    );
  },
};

export const Striped: Story = {
  render: () => {
    const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 5,
    });
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: true }]);
    const columns = useMemo<ColumnDef<IData>[]>(
      () => [
        {
          accessorKey: 'name',
          id: 'name',
          header: 'Name',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarImage src={`/media/avatars/${row.original.avatar}`} alt={row.original.name} />
                  <AvatarFallback>N</AvatarFallback>
                </Avatar>
                <a href="#" className="font-medium text-foreground hover:text-primary">
                  {row.original.name}
                </a>
              </div>
            );
          },
          size: 175,
          enableSorting: true,
          enableHiding: false,
        },
        {
          accessorKey: 'email',
          header: 'Email',
          cell: (info) => (
            <a href={`mailto:${info.getValue()}`} className="hover:text-primary hover:underline">
              {info.getValue() as string}
            </a>
          ),
          size: 180,
        },
        {
          accessorKey: 'location',
          header: 'Location',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-1.5">
                {row.original.flag}
                <div className="font-medium text-foreground">{row.original.location}</div>
              </div>
            );
          },
          size: 170,
        },
        {
          accessorKey: 'balance',
          header: 'Balance ($)',
          cell: (info) => <span className="font-semibold">${(info.getValue() as number).toFixed(2)}</span>,
          size: 120,
          meta: {
            headerClassName: 'text-right rtl:text-left',
            cellClassName: 'text-right rtl:text-left',
          },
        },
      ],
      []
    );
    const table = useReactTable({
      columns,
      data: demoData,
      pageCount: Math.ceil((demoData?.length || 0) / pagination.pageSize),
      getRowId: (row: IData) => row.id,
      state: {
        pagination,
        sorting,
      },
      onPaginationChange: setPagination,
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });
    return (
      <DataGrid
        table={table}
        recordCount={demoData?.length || 0}
        tableLayout={{
          stripped: true,
          rowRounded: true,
        }}
      >
        <div className="w-full space-y-2.5">
          <DataGridContainer border={false}>
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DataGridContainer>
          <DataGridPagination />
        </div>
      </DataGrid>
    );
  },
};

export const AutoWidth: Story = {
  render: () => {
    const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 5,
    });
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: true }]);
    const columns = useMemo<ColumnDef<IData>[]>(
      () => [
        {
          accessorKey: 'name',
          id: 'name',
          header: 'Name',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarImage src={`/media/avatars/${row.original.avatar}`} alt={row.original.name} />
                  <AvatarFallback>N</AvatarFallback>
                </Avatar>
                <a href="#" className="font-medium text-foreground hover:text-primary">
                  {row.original.name}
                </a>
              </div>
            );
          },
          size: 175,
          enableSorting: true,
          enableHiding: false,
        },
        {
          accessorKey: 'email',
          header: 'Email',
          cell: (info) => (
            <a href={`mailto:${info.getValue()}`} className="hover:text-primary hover:underline">
              {info.getValue() as string}
            </a>
          ),
          size: 200,
        },
        {
          accessorKey: 'location',
          header: 'Location',
          cell: (info) => <span>{info.getValue() as string}</span>,
          size: 125,
        },
        {
          accessorKey: 'joined',
          header: 'Joined',
          cell: (info) => info.getValue() as string,
          size: 120,
          meta: {
            cellClassName: 'font-medium',
          },
        },
      ],
      []
    );
    const table = useReactTable({
      columns,
      data: demoData,
      pageCount: Math.ceil((demoData?.length || 0) / pagination.pageSize),
      getRowId: (row) => row.id,
      state: {
        pagination,
        sorting,
      },
      columnResizeMode: 'onChange',
      onPaginationChange: setPagination,
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });
    return (
      <DataGrid
        table={table}
        recordCount={demoData?.length || 0}
        tableLayout={{
          width: 'auto',
        }}
      >
        <div className="w-full space-y-2.5">
          <DataGridContainer>
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DataGridContainer>
          <DataGridPagination />
        </div>
      </DataGrid>
    );
  },
};

export const RowSelection: Story = {
  render: () => {
    const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 5,
    });
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: true }]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    useEffect(() => {
      const selectedRowIds = Object.keys(rowSelection);
      if (selectedRowIds.length > 0) {
        setSelectedIds(selectedRowIds);
      } else {
        setSelectedIds([]);
      }
    }, [rowSelection]);
    const columns = useMemo<ColumnDef<IData>[]>(
      () => [
        {
          accessorKey: 'id',
          header: () => <DataGridTableRowSelectAll />,
          cell: ({ row }) => <DataGridTableRowSelect row={row} />,
          enableSorting: false,
          size: 35,
          meta: {
            headerClassName: '',
            cellClassName: '',
          },
        },
        {
          accessorKey: 'name',
          id: 'name',
          header: 'Name',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-3">
                <Avatar className="size-8">
                  <AvatarImage src={`/media/avatars/${row.original.avatar}`} alt={row.original.name} />
                  <AvatarFallback>N</AvatarFallback>
                </Avatar>
                <div className="space-y-px">
                  <div className="font-medium text-foreground">{row.original.name}</div>
                  <div className="text-muted-foreground">{row.original.email}</div>
                </div>
              </div>
            );
          },
          size: 200,
          enableSorting: true,
          enableHiding: false,
        },
        {
          accessorKey: 'company',
          id: 'company',
          header: 'Role',
          cell: ({ row }) => {
            return (
              <div className="space-y-0.5">
                <div className="font-medium text-foreground">{row.original.role}</div>
                <div className="text-muted-foreground">{row.original.company}</div>
              </div>
            );
          },
          size: 140,
          enableSorting: true,
          enableHiding: false,
        },
        {
          accessorKey: 'location',
          header: 'Location',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-1.5">
                {row.original.flag}
                <div className="font-medium text-foreground">{row.original.location}</div>
              </div>
            );
          },
          size: 180,
          meta: {
            headerClassName: '',
            cellClassName: 'text-start',
          },
        },
        {
          accessorKey: 'joined',
          header: 'Joined',
          cell: (info) => info.getValue() as string,
          size: 120,
          meta: {
            headerClassName: '',
            cellClassName: 'font-medium',
          },
        },
      ],
      []
    );
    const table = useReactTable({
      columns,
      data: demoData,
      pageCount: Math.ceil((demoData?.length || 0) / pagination.pageSize),
      getRowId: (row: IData) => row.id,
      state: {
        pagination,
        sorting,
        rowSelection,
      },
      enableRowSelection: true,
      onRowSelectionChange: setRowSelection,
      onPaginationChange: setPagination,
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });
    return (
      <DataGrid table={table} recordCount={demoData?.length || 0}>
        <div className="w-full space-y-2.5">
          <DataGridContainer>
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DataGridContainer>
          <DataGridPagination />
        </div>
      </DataGrid>
    );
  },
};

export const ExpandableRow: Story = {
  render: () => {
    const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 5,
    });
    const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: true }]);
    const columns = useMemo<ColumnDef<IData>[]>(
      () => [
        {
          id: 'id',
          header: () => null,
          cell: ({ row }) => {
            return row.getCanExpand() ? (
              <Button
                {...{
                  className: 'size-6 text-muted-foreground',
                  onClick: row.getToggleExpandedHandler(),
                  mode: 'icon',
                  variant: 'ghost',
                }}
              >
                {row.getIsExpanded() ? <ChevronUp /> : <ChevronDown />}
              </Button>
            ) : null;
          },
          size: 12,
          meta: {
            expandedContent: (row) => <div className="ms-12 py-3 text-muted-foreground text-sm">{row.details}</div>,
          },
        },
        {
          accessorKey: 'name',
          id: 'name',
          header: 'Name',
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarImage src={`/media/avatars/${row.original.avatar}`} alt={row.original.name} />
                  <AvatarFallback>N</AvatarFallback>
                </Avatar>
                <a href="#" className="font-medium text-foreground hover:text-primary">
                  {row.original.name}
                </a>
              </div>
            );
          },
          size: 175,
          enableSorting: true,
          enableHiding: false,
        },
        {
          accessorKey: 'email',
          header: 'Email',
          cell: (info) => (
            <a href={`mailto:${info.getValue()}`} className="hover:text-primary hover:underline">
              {info.getValue() as string}
            </a>
          ),
          size: 150,
        },
        {
          accessorKey: 'location',
          header: 'Location',
          cell: (info) => <span>{info.getValue() as string}</span>,
          size: 150,
          meta: {
            headerClassName: '',
            cellClassName: 'text-start',
          },
        },
        {
          accessorKey: 'status',
          id: 'status',
          header: 'Status',
          cell: ({ row }) => {
            const status = row.original.status;
            if (status == 'active') {
              return <Badge variant="default">Approved</Badge>;
            } else {
              return <Badge variant="destructive">Pending</Badge>;
            }
          },
          size: 100,
        },
      ],
      []
    );
    const table = useReactTable({
      columns,
      data: demoData,
      pageCount: Math.ceil((demoData?.length || 0) / pagination.pageSize),
      getRowId: (row: IData) => row.id,
      getRowCanExpand: (row) => Boolean(row.original.details),
      state: {
        pagination,
        sorting,
      },
      onPaginationChange: setPagination,
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });
    return (
      <DataGrid table={table} recordCount={demoData?.length || 0} tableLayout={{ headerBackground: false }}>
        <div className="w-full space-y-2.5">
          <DataGridContainer border={false}>
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DataGridContainer>
          <DataGridPagination />
        </div>
      </DataGrid>
    );
  },
};
