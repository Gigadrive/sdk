import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof Table> = {
  title: 'Components/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Accessible table primitives with sensible defaults. Compose `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`, and `TableFooter` to build rich tables. `Table` wraps a native table in a scrollable container for responsive overflow.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default (Horizontal)',
  render: () => (
    <Table>
      <TableCaption>A list of your recent invoices.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">INV001</TableCell>
          <TableCell>Paid</TableCell>
          <TableCell>Credit Card</TableCell>
          <TableCell className="text-right">$250.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">INV002</TableCell>
          <TableCell>Processing</TableCell>
          <TableCell>PayPal</TableCell>
          <TableCell className="text-right">$150.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">INV003</TableCell>
          <TableCell>Unpaid</TableCell>
          <TableCell>Wire</TableCell>
          <TableCell className="text-right">$350.00</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-right">$750.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Standard data table with header, body, and footer. The table is horizontally oriented with column headers in `TableHeader`.',
      },
    },
  },
};

export const Vertical: Story = {
  name: 'Vertical (Key-Value)',
  render: () => (
    <Table>
      <TableCaption>User profile details.</TableCaption>
      <TableBody>
        <TableRow>
          <TableHead scope="row" className="w-[200px]">
            Full name
          </TableHead>
          <TableCell>Jane Cooper</TableCell>
        </TableRow>
        <TableRow>
          <TableHead scope="row">Email</TableHead>
          <TableCell>jane.cooper@example.com</TableCell>
        </TableRow>
        <TableRow>
          <TableHead scope="row">Role</TableHead>
          <TableCell>Product Manager</TableCell>
        </TableRow>
        <TableRow>
          <TableHead scope="row">Location</TableHead>
          <TableCell>San Francisco, USA</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Vertical, key-value layout. Use `TableHead` as the first cell in each row with `scope="row"` for accessibility. This works well for profile or settings summaries.',
      },
    },
  },
};
