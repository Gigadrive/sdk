import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Pagination component provides a flexible and accessible way to navigate through multiple pages of content. It supports various features and customization options to create a professional and functional pagination experience.

## Features
- Responsive design
- Dynamic page generation
- Previous/Next navigation
- Ellipsis for large page counts
- Active page indication
- Dark mode support
- Custom styling options
- Accessibility features
- Mobile-friendly

## Props
- \`className\`: string - Additional CSS classes for the container
- \`children\`: ReactNode - Content to display in the pagination
- \`isActive\`: boolean - Whether the link represents the current page
- \`href\`: string - URL for the page link
- \`size\`: 'default' | 'sm' | 'lg' - Size variant of the pagination
- \`aria-current\`: string - ARIA attribute for the current page
- \`aria-label\`: string - ARIA label for accessibility

## Subcomponents
- \`Pagination\`: Root component
- \`PaginationContent\`: Container for pagination items
- \`PaginationItem\`: Individual pagination item
- \`PaginationLink\`: Link for page navigation
- \`PaginationPrevious\`: Previous page button
- \`PaginationNext\`: Next page button
- \`PaginationEllipsis\`: Ellipsis for skipped pages

## Accessibility
- ARIA roles and attributes
- Keyboard navigation
- Focus management
- Screen reader support
- Color contrast
- Semantic structure
- Responsive design
- Mobile navigation

## Usage Guidelines
1. Keep pagination simple
2. Use clear labels
3. Consider mobile layout
4. Handle responsive behavior
5. Test across devices
6. Ensure proper contrast
7. Support keyboard navigation
8. Follow design system

## Best Practices
- Keep pagination intuitive
- Use meaningful labels
- Consider mobile usage
- Handle edge cases
- Test across devices
- Follow design system
- Document custom styles
- Consider performance

## Customization
- Modify colors
- Adjust spacing
- Change typography
- Customize animations
- Modify borders
- Adjust shadows
- Change transitions
- Customize hover states
`,
      },
    },
  },
  argTypes: {
    className: {
      description: 'Additional CSS classes for the container',
    },
    children: {
      description: 'Content to display in the pagination',
    },
    isActive: {
      description: 'Whether the link represents the current page',
    },
    href: {
      description: 'URL for the page link',
    },
    size: {
      description: 'Size variant of the pagination',
    },
    'aria-current': {
      description: 'ARIA attribute for the current page',
    },
    'aria-label': {
      description: 'ARIA label for accessibility',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" isActive>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A basic pagination with default styling and behavior. Demonstrates the core functionality of the component.',
      },
    },
  },
};

export const WithMorePages: Story = {
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" isActive>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">4</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">5</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">10</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A pagination with more pages and ellipsis. Shows how to handle a larger number of pages.',
      },
    },
  },
};

const DynamicPaginationDemo = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 10;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderPageLinks = () => {
    const items: JSX.Element[] = [];

    // Previous button
    items.push(
      <PaginationItem key="prev">
        <PaginationPrevious
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (currentPage > 1) handlePageChange(currentPage - 1);
          }}
        />
      </PaginationItem>
    );

    // First page
    items.push(
      <PaginationItem key="1">
        <PaginationLink
          href="#"
          isActive={currentPage === 1}
          onClick={(e) => {
            e.preventDefault();
            handlePageChange(1);
          }}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    // Ellipsis after first page
    if (currentPage > 3) {
      items.push(
        <PaginationItem key="ellipsis1">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Pages around current page
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i === 1 || i === totalPages) continue; // Skip first and last pages as they're always shown

      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            href="#"
            isActive={currentPage === i}
            onClick={(e) => {
              e.preventDefault();
              handlePageChange(i);
            }}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Ellipsis before last page
    if (currentPage < totalPages - 2) {
      items.push(
        <PaginationItem key="ellipsis2">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Last page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            href="#"
            isActive={currentPage === totalPages}
            onClick={(e) => {
              e.preventDefault();
              handlePageChange(totalPages);
            }}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Next button
    items.push(
      <PaginationItem key="next">
        <PaginationNext
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (currentPage < totalPages) handlePageChange(currentPage + 1);
          }}
        />
      </PaginationItem>
    );

    return items;
  };

  return (
    <div className="space-y-4">
      <Pagination>
        <PaginationContent>{renderPageLinks()}</PaginationContent>
      </Pagination>
      <div className="text-center text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
};

export const Dynamic: Story = {
  render: () => <DynamicPaginationDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A dynamic pagination with state management. Demonstrates how to handle page changes and display the current page.',
      },
    },
  },
};

export const CustomStyling: Story = {
  render: () => (
    <Pagination className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
      <PaginationContent className="gap-2">
        <PaginationItem>
          <PaginationPrevious href="#" className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
            1
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink
            href="#"
            isActive
            className="bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
            3
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A pagination with custom styling. Shows how to customize the appearance of the pagination component.',
      },
    },
  },
};

export const Compact: Story = {
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink href="#" size="icon">
            <span>1</span>
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" size="icon" isActive>
            <span>2</span>
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" size="icon">
            <span>3</span>
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" size="icon">
            <span>4</span>
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" size="icon">
            <span>5</span>
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};
