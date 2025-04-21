import type { Meta, StoryObj } from '@storybook/react';
import { InfoIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Tooltip component provides additional information when users hover over or focus on an element. It's built on top of Radix UI's Tooltip primitive.

## Features
- Multiple positioning options
- Custom delay duration
- Custom styling support
- Icon integration
- Accessibility features
- Animation support
- Focus management
- Keyboard navigation

## Subcomponents
- \`TooltipProvider\`: Provides context for tooltips
- \`Tooltip\`: The root component
- \`TooltipTrigger\`: The element that triggers the tooltip
- \`TooltipContent\`: The content of the tooltip

## Props
- \`side\`: 'top' | 'right' | 'bottom' | 'left' - The side of the trigger to show the tooltip
- \`sideOffset\`: number - The distance from the trigger
- \`delayDuration\`: number - The delay before showing the tooltip
- \`className\`: string - Additional CSS classes

## Accessibility
- WAI-ARIA compliant
- Keyboard navigation
- Focus management
- Screen reader support
- Proper ARIA attributes
- State announcements
- Color contrast

## Usage Guidelines
1. Use for additional context
2. Keep content concise
3. Choose appropriate position
4. Consider delay timing
5. Test keyboard navigation
6. Ensure proper contrast
7. Handle edge cases
8. Consider mobile usage

## Best Practices
- Limit content length
- Use clear messaging
- Maintain visual hierarchy
- Consider touch devices
- Test across devices
- Ensure responsive behavior
- Follow design system
- Handle multiple tooltips

## Customization
- Adjust colors
- Modify dimensions
- Change border radius
- Add custom styles
- Modify animations
- Adjust spacing
- Customize focus styles
- Change background
`,
      },
    },
  },
  argTypes: {
    side: {
      description: 'The side of the trigger to show the tooltip',
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
    },
    sideOffset: {
      description: 'The distance from the trigger',
      control: 'number',
    },
    delayDuration: {
      description: 'The delay before showing the tooltip',
      control: 'number',
    },
    className: {
      description: 'Additional CSS classes to apply',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const TooltipDemo = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon">
            <InfoIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Add to library</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const Default: Story = {
  render: () => <TooltipDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A basic tooltip with an icon trigger. Demonstrates the default appearance and behavior of the tooltip component.',
      },
    },
  },
};

const TooltipPositionsDemo = () => {
  return (
    <div className="flex items-center justify-center gap-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Top</Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>This tooltip appears on top</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Bottom</Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>This tooltip appears at the bottom</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Left</Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>This tooltip appears on the left</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Right</Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>This tooltip appears on the right</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export const Positions: Story = {
  render: () => <TooltipPositionsDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Tooltips with different positions (top, bottom, left, right). Shows how to position tooltips around their triggers.',
      },
    },
  },
};

const TooltipWithDelayDemo = () => {
  return (
    <TooltipProvider delayDuration={700}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Hover me (delayed)</Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>This tooltip has a 700ms delay</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const WithDelay: Story = {
  render: () => <TooltipWithDelayDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A tooltip with a custom delay duration. Demonstrates how to add a delay before showing the tooltip.',
      },
    },
  },
};

const TooltipWithCustomStylesDemo = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Custom Styled</Button>
        </TooltipTrigger>
        <TooltipContent className="bg-primary text-primary-foreground border-primary">
          <p>This tooltip has custom styling</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const CustomStyles: Story = {
  render: () => <TooltipWithCustomStylesDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A tooltip with custom styling. Shows how to apply custom colors and styles to the tooltip content.',
      },
    },
  },
};

const TooltipWithIconDemo = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <InfoIcon className="h-4 w-4" />
            <span>Help</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Get help with this feature</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const WithIcon: Story = {
  render: () => <TooltipWithIconDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A tooltip with an icon in the trigger. Demonstrates how to combine icons with tooltips for better visual communication.',
      },
    },
  },
};
