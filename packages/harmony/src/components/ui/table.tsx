/* eslint-disable react/prop-types */
import { cn } from '@/lib/utils';
import * as React from 'react';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * `compact` tightens header and cell chrome for operational data tables
   * (36px header band on `bg-muted/30`, tighter cell padding, smaller header text).
   */
  density?: 'default' | 'compact';
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(({ className, density = 'default', ...props }, ref) => (
  <div data-slot="table-wrapper" className="relative w-full overflow-auto">
    <table
      ref={ref}
      data-slot="table"
      data-density={density}
      className={cn('group/table w-full caption-bottom text-foreground text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} data-slot="table-header" className={cn('bg-muted/30 [&_tr]:border-b', className)} {...props} />
  )
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  )
);
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      data-slot="table-footer"
      className={cn('border-t bg-muted/50 font-medium last:[&>tr]:border-b-0', className)}
      {...props}
    />
  )
);
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      data-slot="table-row"
      className={cn(
        'border-b transition-colors [&:has(td):hover]:bg-muted/50 data-[state=selected]:bg-muted',
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      data-slot="table-head"
      className={cn(
        'h-12 px-4 text-left rtl:text-right align-middle font-normal text-muted-foreground [&:has([role=checkbox])]:pe-0',
        'group-data-[density=compact]/table:h-9 group-data-[density=compact]/table:px-3 group-data-[density=compact]/table:py-0 group-data-[density=compact]/table:text-xs group-data-[density=compact]/table:font-medium',
        className
      )}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      data-slot="table-cell"
      className={cn(
        'p-4 align-middle [&:has([role=checkbox])]:pe-0',
        'group-data-[density=compact]/table:px-3 group-data-[density=compact]/table:py-2',
        className
      )}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
);
TableCaption.displayName = 'TableCaption';

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
