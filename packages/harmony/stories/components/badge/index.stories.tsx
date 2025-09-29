import type { Meta, StoryObj } from '@storybook/react';

import { AlertCircle, Info, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A versatile badge component for displaying short status descriptors, labels, or counts.

## Features
- Multiple visual variants (default, secondary, destructive, outline)
- Customizable through className
- Support for icons and text
- Hover states for interactive badges
- Focus states for keyboard navigation
- Dark mode compatible
- Rounded design for visual distinction

## Usage Guidelines
- Use badges to highlight status, categories, or counts
- Use default variant for primary information
- Use secondary variant for supplementary information
- Use destructive variant for error states or warnings
- Use outline variant for subtle indicators
- Keep text content short and concise
- Consider using icons to enhance meaning

## Best Practices
- Keep badge text concise (1-3 words maximum)
- Use consistent variants for similar types of information
- Ensure sufficient color contrast for accessibility
- Don't overuse badges - they should highlight important information
- Consider using tooltips for badges that need more explanation
- Use appropriate spacing when grouping multiple badges
- Maintain consistent sizing within the same context

## Accessibility
- High contrast colors for better readability
- Focus states for keyboard navigation
- Proper text size for legibility
- Semantic HTML structure
- Color is not the only means of conveying information

## Customization
- Custom colors through className
- Icon support
- Size adjustments through className
- Border customization through variant or className
`,
      },
    },
  },
  argTypes: {
    variant: {
      description: 'The visual style variant of the badge',
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
      table: {
        defaultValue: { summary: 'default' },
      },
    },
    className: {
      description: 'Additional CSS classes to apply to the badge',
      control: 'text',
    },
    children: {
      description: 'The content to display inside the badge',
      control: 'text',
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Badge',
  },
  parameters: {
    docs: {
      description: {
        story: 'Default badge style, used for primary information.',
      },
    },
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
  parameters: {
    docs: {
      description: {
        story: 'Secondary variant, used for supplementary information.',
      },
    },
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive',
  },
  parameters: {
    docs: {
      description: {
        story: 'Destructive variant, used for error states or warnings.',
      },
    },
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
  parameters: {
    docs: {
      description: {
        story: 'Outline variant, used for subtle indicators.',
      },
    },
  },
};

export const WithCustomClass: Story = {
  args: {
    children: 'Custom',
    className: 'bg-blue-500 text-white hover:bg-blue-600',
  },
  parameters: {
    docs: {
      description: {
        story: 'Example of customizing badge appearance using Tailwind classes.',
      },
    },
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available badge variants displayed together for comparison.',
      },
    },
  },
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge className="gap-1">
        <Sparkles aria-hidden />
        New
      </Badge>
      <Badge variant="secondary" className="gap-1">
        <Info aria-hidden />
        Info
      </Badge>
      <Badge variant="destructive" className="gap-1">
        <AlertCircle aria-hidden />
        Error
      </Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Examples of badges with icons to enhance visual meaning.',
      },
    },
  },
};
