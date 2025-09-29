import type { Meta, StoryObj } from '@storybook/react';
import { FileText, Folder, Search } from 'lucide-react';

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
1. Keep the message concise and actionable
2. Prefer offering a clear next step via \`action\`
3. Use one icon for simple states, three for richer visual emphasis
4. Ensure the title communicates the core issue (e.g., “No results”)
5. Consider adding helpful context in the description

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
