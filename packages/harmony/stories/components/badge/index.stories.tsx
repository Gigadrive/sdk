import type { Meta, StoryObj } from '@storybook/react-vite';

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
- Multiple visual variants (default, secondary, destructive, outline, soft)
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
- Use soft variant for tonal accents such as plan or tier labels
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
      options: ['default', 'secondary', 'destructive', 'outline', 'soft'],
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

export const Soft: Story = {
  args: {
    variant: 'soft',
    children: 'Pro',
  },
  parameters: {
    docs: {
      description: {
        story: 'Soft variant — a tonal pill for plan, tier or category labels.',
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
      <Badge variant="soft">Soft</Badge>
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

const ShowcasePanel = ({ theme }: { theme: 'light' | 'dark' }) => (
  <div className={`${theme} w-[420px] rounded-xl border border-border bg-background p-6 text-foreground`}>
    <p className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">{theme}</p>
    <div className="mb-6 flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="soft">Soft</Badge>
    </div>
    <div className="mb-6 flex items-center gap-2 border-t border-border pt-5">
      <div className="size-7 rounded-full bg-muted" />
      <span className="text-lg font-medium">Northwind Labs</span>
      <Badge variant="soft">Pro</Badge>
    </div>
    <div className="divide-y divide-border border-t border-border">
      {['main', 'feat/badges', 'fix/theme'].map((branch) => (
        <div key={branch} className="flex items-center justify-between py-2.5 text-sm">
          <span className="text-muted-foreground">{branch}</span>
          <Badge variant="outline" className="font-normal">
            Preview
          </Badge>
        </div>
      ))}
    </div>
  </div>
);

export const Showcase: Story = {
  render: () => (
    <div className="flex gap-6">
      <ShowcasePanel theme="light" />
      <ShowcasePanel theme="dark" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Every variant rendered in both themes, plus the header and table contexts badges appear in.',
      },
    },
  },
};
