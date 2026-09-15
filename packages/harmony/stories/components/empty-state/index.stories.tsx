import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileText, Folder, Search } from 'lucide-react';

import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
An empty state component used to communicate a lack of content and guide users toward the next action.

## Features
- Fills the width of its container by default (the title and description keep a
  readable measure, so long copy never stretches edge to edge)
- Simple, focused visual design
- Optional single or three-icon layout
- Action button for recovery/next step
- Accessible and responsive by default
- Customizable via className

## Props
- \`title\`: string — Main heading
- \`description\`: string — Supporting message (supports line breaks)
- \`icons\`: LucideIcon[] — Optional icons to display (pass 1 or 3)
- \`action\`: { label: string; onClick: () => void } — Optional CTA
- \`className\`: string — Additional classes for custom styling

## Usage Guidelines
1. The box spans its container. Pass a \`max-w-*\` class when you deliberately want to cap it
2. Keep the message concise and actionable
3. Prefer offering a clear next step via \`action\`
4. Use one icon for simple states, three for richer visual emphasis
5. Ensure the title communicates the core issue (e.g., “No results”)
6. Consider adding helpful context in the description

## Accessibility
- Semantic structure for headings and content
- High contrast and keyboard focus states via design tokens
        `,
      },
    },
  },
  argTypes: {
    title: {
      description: 'Main heading of the empty state',
      control: 'text',
    },
    description: {
      description: 'Supporting message. Use line breaks for multi-line content',
      control: 'text',
    },
    icons: {
      description: 'Array of Lucide icons (pass 1 or 3 for special layout)',
      control: false,
    },
    action: {
      description: 'Optional call to action { label, onClick }',
      control: false,
    },
    className: {
      description: 'Additional CSS classes for the root container',
      control: 'text',
    },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Nothing here yet',
    description: 'Get started by creating your first item.',
  },
  parameters: {
    docs: {
      description: {
        story: 'A basic empty state with title and description.',
      },
    },
  },
};

export const WithIcon: Story = {
  args: {
    title: 'No results found',
    description: 'Try adjusting your filters or search terms to find what you need.',
    icons: [Search],
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state with a single icon for simple emphasis.',
      },
    },
  },
};

export const WithThreeIcons: Story = {
  args: {
    title: 'No documents yet',
    description: 'Create or upload files to see them listed here.',
    icons: [Folder, FileText, Search],
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state with three icons. The component arranges them with subtle offsets and motion.',
      },
    },
  },
};

export const WithAction: Story = {
  args: {
    title: 'No content available',
    description: 'You can add new content or refresh to try again.',
    icons: [Folder],
    action: {
      label: 'Create Item',
      onClick: () => {
        alert('Create action clicked');
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state with a call-to-action button to guide users to the next step.',
      },
    },
  },
};

export const FullWidthContainer: Story = {
  args: {
    title: 'No deployments yet',
    description: 'Deployments will appear here once your first build finishes.',
    icons: [Folder],
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'The empty state fills its container. In a container wider than 620px the dashed border reaches both edges instead of stopping partway across.',
      },
    },
  },
  render: (args) => (
    <div className="w-[1100px] max-w-full p-6">
      <EmptyState {...args} />
    </div>
  ),
};

export const NarrowContainer: Story = {
  args: {
    title: 'No results found',
    description: 'Try adjusting your filters or search terms to find what you need.',
    icons: [Search],
  },
  parameters: {
    docs: {
      description: {
        story: 'In a narrow container the padding scales down so nothing overflows.',
      },
    },
  },
  render: (args) => (
    <div className="w-[400px] max-w-full">
      <EmptyState {...args} />
    </div>
  ),
};

export const LongDescription: Story = {
  args: {
    title: 'Nothing to show here',
    description:
      'This project has no environment variables yet. Environment variables are encrypted at rest and injected into your builds and running deployments, so you can keep configuration out of your repository and vary it per environment.',
    icons: [Folder, FileText, Search],
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'On a wide screen the box spans its container while the title and description stay capped at a readable measure.',
      },
    },
  },
  render: (args) => (
    <div className="w-[1100px] max-w-full p-6">
      <EmptyState {...args} />
    </div>
  ),
};

export const InDataTable: Story = {
  args: {
    title: 'No team members',
    description: 'Invite someone to collaborate on this project.',
    icons: [Folder],
    action: {
      label: 'Invite member',
      onClick: () => {
        alert('Invite action clicked');
      },
    },
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          "Rendered into DataTable's `emptyState` slot. The box spans every column of the table rather than covering only the first ones.",
      },
    },
  },
  render: (args) => (
    <div className="w-[1100px] max-w-full p-6">
      <DataTable
        columns={[
          { id: 'name', header: 'Name' },
          { id: 'email', header: 'Email' },
          { id: 'role', header: 'Role' },
          { id: 'status', header: 'Status' },
        ]}
        data={[]}
        emptyState={<EmptyState {...args} />}
      />
    </div>
  ),
};
