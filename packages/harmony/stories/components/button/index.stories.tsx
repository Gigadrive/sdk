import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/ui/button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A versatile button component that follows WAI-ARIA guidelines and supports multiple variants, sizes, and states.

## Features
- Multiple visual variants (default, secondary, destructive, outline, ghost, link)
- Different sizes (small, default, large)
- Wide option for full-width buttons
- Support for icons and text content
- Keyboard navigation and focus management
- Disabled state styling
- Customizable via className prop

## Accessibility
- Follows WAI-ARIA button pattern
- Proper focus management
- Keyboard navigation support
- High contrast states
- Disabled state handling

## Usage Guidelines
- Use the default variant for primary actions
- Use secondary variant for alternative actions
- Use destructive variant for dangerous actions
- Use outline variant for less prominent actions
- Use ghost variant for toolbar actions
- Use link variant for navigation-like actions
- Add icons to buttons to enhance visual comprehension
- Maintain consistent button hierarchy in your UI
`,
      },
    },
  },
  argTypes: {
    variant: {
      description: 'The visual style variant of the button',
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
      table: {
        defaultValue: { summary: 'default' },
      },
    },
    size: {
      description: 'The size of the button',
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      table: {
        defaultValue: { summary: 'default' },
      },
    },
    wide: {
      description: 'Whether the button should take full width',
      control: 'boolean',
      table: {
        defaultValue: { summary: false },
      },
    },
    asChild: {
      description: 'Whether to render as a child component (using Radix UI Slot)',
      control: 'boolean',
      table: {
        defaultValue: { summary: false },
      },
    },
    disabled: {
      description: 'Whether the button is disabled',
      control: 'boolean',
    },
    children: {
      description: 'The content to display inside the button',
      control: 'text',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
  parameters: {
    docs: {
      description: {
        story: 'The default button style, used for primary actions.',
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
        story: 'Secondary style, used for alternative actions.',
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
        story: 'Destructive style, used for dangerous actions like delete.',
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
        story: 'Outline style, used for less prominent actions.',
      },
    },
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
  parameters: {
    docs: {
      description: {
        story: 'Ghost style, used for toolbar actions.',
      },
    },
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link',
  },
  parameters: {
    docs: {
      description: {
        story: 'Link style, used for navigation-like actions.',
      },
    },
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small',
  },
  parameters: {
    docs: {
      description: {
        story: 'Small size variant, useful for compact UIs.',
      },
    },
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large',
  },
  parameters: {
    docs: {
      description: {
        story: 'Large size variant, useful for prominent actions.',
      },
    },
  },
};

export const Wide: Story = {
  args: {
    wide: true,
    children: 'Wide Button',
  },
  parameters: {
    docs: {
      description: {
        story: 'Full-width variant, useful for mobile or stacked layouts.',
      },
    },
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
        With Icon
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Button with an icon, showing how to combine icons and text.',
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled Button',
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Disabled state, used when the action is not available.',
      },
    },
  },
};
