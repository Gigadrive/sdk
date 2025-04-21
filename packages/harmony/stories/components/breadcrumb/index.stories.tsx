import type { Meta, StoryObj } from '@storybook/react';
import { ChevronRight, FileText, Home, Settings } from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const meta = {
  title: 'Components/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A composable breadcrumb navigation component that helps users understand their current location within a hierarchical structure.

## Features
- Composable architecture with multiple subcomponents
- Support for icons
- Custom separators
- Responsive design support
- Ellipsis for long paths
- Accessible by default
- Dark mode compatible
- Customizable styling

## Subcomponents
- \`Breadcrumb\`: The root container component
- \`BreadcrumbList\`: Ordered list container for breadcrumb items
- \`BreadcrumbItem\`: Individual breadcrumb item container
- \`BreadcrumbLink\`: Interactive link element
- \`BreadcrumbPage\`: Current page indicator
- \`BreadcrumbSeparator\`: Visual separator between items
- \`BreadcrumbEllipsis\`: Truncation indicator for long paths

## Accessibility
- Uses semantic HTML structure with nav and ol elements
- Proper ARIA labels and roles
- Keyboard navigation support
- Clear visual hierarchy
- Screen reader friendly
- Proper focus management

## Usage Guidelines
- Use for hierarchical navigation structures
- Place at the top of the page
- Show current location context
- Keep paths concise
- Use ellipsis for long paths
- Consider responsive behavior
- Maintain consistent styling

## Best Practices
- Keep breadcrumb paths shallow (3-5 levels max)
- Use clear and concise labels
- Ensure all links are working
- Consider mobile viewports
- Use appropriate icons if needed
- Maintain consistent separator style
- Show current page as non-interactive
- Use ellipsis for long paths responsibly

## Customization
- Custom separators
- Icon support
- Color schemes
- Responsive styles
- Hover states
- Font styles
- Spacing adjustments
`,
      },
    },
  },
  argTypes: {
    className: {
      description: 'Additional CSS classes to apply to the breadcrumb container',
      control: 'text',
    },
    separator: {
      description: 'Custom separator element to use between items',
      control: 'text',
    },
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/components">Components</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Basic breadcrumb navigation with default chevron separator.',
      },
    },
  },
};

export const WithIcons: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">
            <Home className="h-4 w-4 mr-1" />
            Home
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/components">
            <FileText className="h-4 w-4 mr-1" />
            Components
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Breadcrumb with icons to enhance visual hierarchy and recognition.',
      },
    },
  },
};

export const WithEllipsis: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/components/breadcrumb">Components</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Using ellipsis to indicate truncated paths in long navigation structures.',
      },
    },
  },
};

export const WithCustomSeparator: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>•</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink href="/components">Components</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>•</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Custom separator example using a bullet point instead of the default chevron.',
      },
    },
  },
};

export const WithCustomStyles: Story = {
  render: () => (
    <Breadcrumb className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
      <BreadcrumbList className="text-blue-500 dark:text-blue-400">
        <BreadcrumbItem>
          <BreadcrumbLink href="/" className="font-medium hover:text-blue-700 dark:hover:text-blue-300">
            Home
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-gray-400">
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink href="/components" className="font-medium hover:text-blue-700 dark:hover:text-blue-300">
            Components
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-gray-400">
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage className="font-bold">Breadcrumb</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of custom styling with background, colors, and hover states.',
      },
    },
  },
};

export const Responsive: Story = {
  render: () => (
    <div className="w-full max-w-3xl mx-auto">
      <Breadcrumb>
        <BreadcrumbList className="flex-wrap">
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:flex" />
          <BreadcrumbItem className="hidden md:inline-flex">
            <BreadcrumbLink href="/products">Products</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:flex" />
          <BreadcrumbItem className="hidden lg:inline-flex">
            <BreadcrumbLink href="/products/electronics">Electronics</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden lg:flex" />
          <BreadcrumbItem>
            <BreadcrumbPage>Smartphones</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Responsive breadcrumb that adapts to different screen sizes by showing/hiding items.',
      },
    },
  },
};
