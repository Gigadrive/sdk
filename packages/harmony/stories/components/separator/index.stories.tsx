import type { Meta, StoryObj } from '@storybook/react';

import { Separator } from '@/components/ui/separator';

const meta = {
  title: 'Components/Separator',
  component: Separator,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Separator component is a simple visual divider that can be used to separate content either horizontally or vertically. It's built on top of Radix UI's Separator primitive and provides a clean way to create visual separation between elements.

## Features
- Horizontal and vertical orientations
- Customizable styling
- Dark mode support
- Responsive design
- Type-safe props
- Accessible by default
- Decorative option
- Flexible sizing

## Props
- \`orientation\`: 'horizontal' | 'vertical' - The orientation of the separator
- \`decorative\`: boolean - Whether the separator is purely decorative
- \`className\`: string - Additional CSS classes

## Accessibility
- WAI-ARIA compliant
- Screen reader friendly
- ARIA attributes
- Role attributes
- Proper semantic meaning
- Decorative option

## Usage Guidelines
1. Use for visual separation
2. Choose appropriate orientation
3. Maintain consistent styling
4. Consider spacing
5. Use decorative option when appropriate
6. Test with screen readers
7. Ensure proper contrast
8. Consider responsive behavior

## Best Practices
- Keep separators subtle
- Use consistent patterns
- Maintain visual hierarchy
- Use appropriate spacing
- Consider touch targets
- Test across devices
- Ensure responsive behavior
- Follow design system

## Customization
- Adjust colors
- Modify thickness
- Change spacing
- Add gradients
- Use custom styles
- Modify transitions
- Adjust opacity
- Customize borders
`,
      },
    },
  },
  argTypes: {
    orientation: {
      description: 'The orientation of the separator',
      control: 'radio',
      options: ['horizontal', 'vertical'],
    },
    decorative: {
      description: 'Whether the separator is purely decorative',
      control: 'boolean',
    },
    className: {
      description: 'Additional CSS classes to apply to the separator',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

const SeparatorDemo = () => {
  return (
    <div>
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Radix Primitives</h4>
        <p className="text-sm text-muted-foreground">An open-source UI component library.</p>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center space-x-4 text-sm">
        <div>Blog</div>
        <Separator orientation="vertical" />
        <div>Docs</div>
        <Separator orientation="vertical" />
        <div>Source</div>
      </div>
    </div>
  );
};

export const Default: Story = {
  render: () => <SeparatorDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A basic example showing both horizontal and vertical separators in a common layout pattern.',
      },
    },
  },
};

const HorizontalSeparatorDemo = () => {
  return (
    <div className="w-[400px]">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Horizontal Separator</h4>
        <p className="text-sm text-muted-foreground">Used to visually separate content horizontally.</p>
      </div>
      <Separator className="my-4" />
      <p className="text-sm text-muted-foreground">The content below the separator.</p>
    </div>
  );
};

export const Horizontal: Story = {
  render: () => <HorizontalSeparatorDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A horizontal separator used to divide content sections vertically.',
      },
    },
  },
};

const VerticalSeparatorDemo = () => {
  return (
    <div className="flex h-20 items-center space-x-4">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Left Content</h4>
        <p className="text-sm text-muted-foreground">Description for left side.</p>
      </div>
      <Separator orientation="vertical" className="h-full" />
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Right Content</h4>
        <p className="text-sm text-muted-foreground">Description for right side.</p>
      </div>
    </div>
  );
};

export const Vertical: Story = {
  render: () => <VerticalSeparatorDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A vertical separator used to divide content sections horizontally.',
      },
    },
  },
};

const CustomStyledSeparatorDemo = () => {
  return (
    <div className="w-[400px]">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Custom Styled Separator</h4>
        <p className="text-sm text-muted-foreground">Separators can be customized with different styles.</p>
      </div>
      <Separator className="my-4 bg-primary" />
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Gradient Separator</h4>
        <p className="text-sm text-muted-foreground">Using background gradients for visual interest.</p>
      </div>
      <Separator className="my-4 h-[2px] bg-linear-to-r from-primary to-secondary" />
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Dashed Separator</h4>
        <p className="text-sm text-muted-foreground">Using border styles instead of background.</p>
      </div>
      <div className="my-4 h-[1px] w-full border-t-2 border-dashed" />
    </div>
  );
};

export const CustomStyling: Story = {
  render: () => <CustomStyledSeparatorDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Examples of separators with custom styling, including solid colors, gradients, and dashed borders.',
      },
    },
  },
};
