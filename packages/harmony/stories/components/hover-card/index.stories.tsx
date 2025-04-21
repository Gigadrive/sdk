import type { Meta, StoryObj } from '@storybook/react';
import { CalendarDays } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

const meta: Meta<typeof HoverCard> = {
  title: 'Components/HoverCard',
  component: HoverCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Hover Card component provides a rich preview of content that appears when users hover over a trigger element. It's perfect for displaying additional information, user profiles, or contextual details without requiring a click.

## Features
- Hover-based activation
- Customizable positioning (top, right, bottom, left)
- Configurable open/close delays
- Smooth animations
- Accessible design
- Customizable width and content
- Flexible trigger elements

## Subcomponents
- \`HoverCard\`: The root component that manages the hover state
- \`HoverCardTrigger\`: The element that triggers the hover card
- \`HoverCardContent\`: The content container that appears on hover

## Accessibility
- Follows WAI-ARIA Hover Card pattern
- Keyboard navigation support
- Screen reader friendly
- Proper ARIA attributes

## Usage Guidelines
1. Use for supplementary information that doesn't require immediate interaction
2. Keep content concise and relevant
3. Ensure trigger elements are clearly identifiable
4. Consider mobile users (hover cards may not be ideal for touch interfaces)

## Best Practices
- Use appropriate delay times to prevent accidental triggers
- Position cards to avoid viewport edges
- Keep content focused and scannable
- Use consistent styling across your application

## Props
- \`openDelay\`: Delay before opening (default: 700ms)
- \`closeDelay\`: Delay before closing (default: 300ms)
- \`defaultOpen\`: Initial open state
- \`onOpenChange\`: Callback when open state changes
- \`className\`: Additional CSS classes

## Customization
- Adjust width using className
- Customize animations through CSS
- Modify positioning with align and side props
- Style content freely within HoverCardContent
`,
      },
    },
  },
  argTypes: {
    openDelay: {
      description: 'Delay in milliseconds before opening the hover card',
      control: 'number',
    },
    closeDelay: {
      description: 'Delay in milliseconds before closing the hover card',
      control: 'number',
    },
    defaultOpen: {
      description: 'Whether the hover card is open by default',
      control: 'boolean',
    },
    onOpenChange: {
      description: 'Callback when the open state changes',
      action: 'onOpenChange',
    },
    className: {
      description: 'Additional CSS classes to apply to the hover card',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const HoverCardDemo = () => {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link">@Gigadrive</Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex justify-between space-x-4">
          <Avatar>
            <AvatarImage src="https://github.com/Gigadrive.png" />
            <AvatarFallback>GD</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h4 className="text-sm font-medium">@Gigadrive</h4>
            <p className="text-sm">Software Development company based in Germany</p>
            <div className="flex items-center pt-2">
              <CalendarDays className="mr-2 h-4 w-4 opacity-70" />
              <span className="text-xs text-muted-foreground">Joined November 2014</span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export const Default: Story = {
  render: () => <HoverCardDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A basic hover card example showing a user profile with avatar, name, description, and join date. Demonstrates the default positioning and styling.',
      },
    },
  },
};

const PositionedHoverCardDemo = () => {
  return (
    <div className="flex items-center justify-center space-x-4">
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant="outline">Hover Left</Button>
        </HoverCardTrigger>
        <HoverCardContent align="start" side="left" className="w-80">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Left Positioned Card</h4>
            <p className="text-sm">This hover card appears on the left side of the trigger.</p>
          </div>
        </HoverCardContent>
      </HoverCard>

      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant="outline">Hover Right</Button>
        </HoverCardTrigger>
        <HoverCardContent align="start" side="right" className="w-80">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Right Positioned Card</h4>
            <p className="text-sm">This hover card appears on the right side of the trigger.</p>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
};

export const Positioned: Story = {
  render: () => <PositionedHoverCardDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates different positioning options for hover cards. Shows how to position cards on the left and right sides of the trigger element.',
      },
    },
  },
};

const DelayedHoverCardDemo = () => {
  return (
    <HoverCard openDelay={300} closeDelay={200}>
      <HoverCardTrigger asChild>
        <Button variant="outline">Delayed Hover</Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Delayed Hover Card</h4>
          <p className="text-sm">This hover card has a 300ms delay before opening and 200ms delay before closing.</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export const Delayed: Story = {
  render: () => <DelayedHoverCardDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Shows how to customize the open and close delays of a hover card. This example uses a 300ms open delay and 200ms close delay for smoother interaction.',
      },
    },
  },
};

const CustomWidthHoverCardDemo = () => {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="outline">Custom Width</Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-96">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Custom Width Hover Card</h4>
          <p className="text-sm">
            This hover card has a custom width of 24rem (w-96) instead of the default 16rem (w-64). It demonstrates how
            you can customize the appearance of hover cards.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export const CustomWidth: Story = {
  render: () => <CustomWidthHoverCardDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates how to customize the width of a hover card using Tailwind CSS classes. This example uses a wider width (w-96) to accommodate more content.',
      },
    },
  },
};
