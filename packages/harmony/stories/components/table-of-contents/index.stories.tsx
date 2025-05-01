import { TableOfContents } from '@/components/ui/table-of-contents';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof TableOfContents> = {
  title: 'Components/TableOfContents',
  component: TableOfContents,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A responsive Table of Contents component that automatically adapts to screen size.

## Features
- Automatic active section highlighting
- Smooth animations
- Optional responsive design
- Mobile-friendly drawer interface with customizable button position
- Keyboard accessible
- Screen reader friendly

## Usage
\`\`\`tsx
<TableOfContents
  items={[
    { id: 'section-1', title: 'Section 1', level: 1 },
    { id: 'subsection-1', title: 'Subsection 1.1', level: 2 },
  ]}
  responsive={true} // Optional: Whether to show mobile drawer or always show sidebar
  mobilePosition="bottom-right" // Optional: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center' | 'top-center'
  mobileOffset="1rem" // Optional: custom offset from the edge
/>
\`\`\`

## Accessibility
- Uses semantic HTML
- Proper heading structure
- ARIA labels
- Keyboard navigation support
`,
      },
    },
  },
  argTypes: {
    responsive: {
      control: 'boolean',
      description: 'Whether to show mobile drawer or always show sidebar',
      defaultValue: true,
    },
    mobilePosition: {
      control: 'select',
      options: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'bottom-center', 'top-center'],
      description: 'Position of the mobile drawer trigger button',
      defaultValue: 'bottom-right',
    },
    mobileOffset: {
      control: 'text',
      description: 'Custom offset from the edge for the mobile button',
    },
    showActiveIndicator: {
      control: 'boolean',
      description: 'Whether to show the active section indicator',
      defaultValue: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof TableOfContents>;

const DemoContent = () => (
  <div className="prose max-w-2xl mx-auto p-4">
    <h1 id="introduction">Introduction</h1>
    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore
      magna aliqua.
    </p>

    <h2 id="getting-started">Getting Started</h2>
    <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>

    <h3 id="prerequisites">Prerequisites</h3>
    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>

    <h2 id="features">Features</h2>
    <p>
      Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
    </p>

    <h3 id="feature-1">Feature 1</h3>
    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore
      magna aliqua.
    </p>

    <h3 id="feature-2">Feature 2</h3>
    <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>

    <h2 id="conclusion">Conclusion</h2>
    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
  </div>
);

const items = [
  { id: 'introduction', title: 'Introduction', level: 1 },
  { id: 'getting-started', title: 'Getting Started', level: 2 },
  { id: 'prerequisites', title: 'Prerequisites', level: 3 },
  { id: 'features', title: 'Features', level: 2 },
  { id: 'feature-1', title: 'Feature 1', level: 3 },
  { id: 'feature-2', title: 'Feature 2', level: 3 },
  { id: 'conclusion', title: 'Conclusion', level: 2 },
];

export const Default: Story = {
  args: {
    items,
    responsive: true,
    mobilePosition: 'bottom-right',
  },
  render: (args) => (
    <div className="flex gap-8">
      <div className="hidden md:block w-64 shrink-0">
        <TableOfContents {...args} className="sticky top-4" />
      </div>
      <DemoContent />
      <TableOfContents {...args} className="md:hidden" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The Table of Contents component automatically adapts to screen size. On desktop, it appears as a sidebar. On mobile, it shows as a floating button that opens a drawer.',
      },
    },
  },
};

export const NonResponsive: Story = {
  args: {
    items,
    responsive: false,
  },
  render: (args) => (
    <div className="flex gap-8">
      <div className="w-64 shrink-0">
        <TableOfContents {...args} className="sticky top-4" />
      </div>
      <DemoContent />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Table of Contents with responsive behavior disabled. Always shows as a sidebar regardless of screen size.',
      },
    },
  },
};

export const WithCustomPosition: Story = {
  args: {
    items,
    responsive: true,
    mobilePosition: 'bottom-center',
    mobileOffset: '2rem',
  },
  render: (args) => (
    <div className="flex gap-8">
      <div className="hidden md:block w-64 shrink-0">
        <TableOfContents {...args} className="sticky top-4" />
      </div>
      <DemoContent />
      <TableOfContents {...args} className="md:hidden" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Table of Contents with custom mobile button position (bottom-center) and offset.',
      },
    },
  },
};

export const WithoutActiveIndicator: Story = {
  args: {
    items,
    responsive: true,
    showActiveIndicator: false,
    mobilePosition: 'bottom-right',
  },
  render: (args) => (
    <div className="flex gap-8">
      <div className="hidden md:block w-64 shrink-0">
        <TableOfContents {...args} className="sticky top-4" />
      </div>
      <DemoContent />
      <TableOfContents {...args} className="md:hidden" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The Table of Contents without the active section indicator.',
      },
    },
  },
};
