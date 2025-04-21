import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useState } from 'react';

const meta = {
  title: 'Components/ScrollArea',
  component: ScrollArea,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Scroll Area component is a customizable scrollable container that provides a consistent scrolling experience across different browsers and devices. It's built on top of Radix UI's Scroll Area primitive and offers a rich set of features for creating scrollable content areas.

## Features
- Custom scrollbar styling
- Horizontal and vertical scrolling
- Touch device support
- Keyboard navigation
- Customizable styling
- Dark mode support
- Responsive design
- Type-safe props
- Accessible by default
- Smooth scrolling
- Dynamic content support

## Subcomponents
- \`ScrollArea\`: The root container component
- \`ScrollBar\`: The scrollbar component
- \`ScrollAreaViewport\`: The viewport component
- \`ScrollAreaCorner\`: The corner component

## Accessibility
- WAI-ARIA compliant
- Keyboard navigation support
- Screen reader friendly
- Focus management
- ARIA attributes
- Role attributes
- Proper heading structure
- Semantic HTML

## Usage Guidelines
1. Use appropriate height and width
2. Consider content overflow
3. Maintain consistent styling
4. Test on different devices
5. Ensure proper focus management
6. Use appropriate spacing
7. Consider touch targets
8. Test with screen readers

## Best Practices
- Keep content organized
- Use consistent patterns
- Provide visual feedback
- Maintain visual hierarchy
- Use appropriate spacing
- Consider touch targets
- Test across devices
- Ensure responsive behavior

## Customization
- Adjust colors and themes
- Modify spacing and sizing
- Customize scrollbar
- Change typography
- Add custom styles
- Modify transitions
- Adjust focus styles
- Customize hover states
`,
      },
    },
  },
  argTypes: {
    className: {
      description: 'Additional CSS classes to apply to the scroll area',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const ScrollAreaDemo = () => {
  return (
    <ScrollArea className="h-[200px] w-[350px] rounded-md border p-4">
      <div className="space-y-4">
        <h4 className="text-sm font-medium leading-none">Scroll Area Example</h4>
        <p className="text-sm text-muted-foreground">
          This is a basic example of a scroll area. The content inside this container will scroll when it exceeds the
          height.
        </p>
        <div className="space-y-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
              Item {i + 1}
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};

export const Default: Story = {
  render: () => <ScrollAreaDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A basic scroll area with vertical scrolling. Demonstrates common usage with a list of items.',
      },
    },
  },
};

const LongContentScrollAreaDemo = () => {
  return (
    <ScrollArea className="h-[300px] w-[400px] rounded-md border p-4">
      <div className="space-y-4">
        <h4 className="text-sm font-medium leading-none">Long Content Example</h4>
        <p className="text-sm text-muted-foreground">
          This example demonstrates scrolling through a large amount of content.
        </p>
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <h5 className="text-sm font-medium">Section {i + 1}</h5>
              <p className="text-sm text-muted-foreground">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
                dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
                ex ea commodo consequat.
              </p>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};

export const LongContent: Story = {
  render: () => <LongContentScrollAreaDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A scroll area with long text content. Shows how to handle large amounts of text with proper spacing and typography.',
      },
    },
  },
};

const HorizontalScrollAreaDemo = () => {
  return (
    <ScrollArea className="h-[120px] w-[400px] rounded-md border">
      <div className="flex p-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="flex h-80 w-80 items-center justify-center rounded-md border border-slate-200 mr-4 dark:border-slate-700"
          >
            Horizontal Item {i + 1}
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export const Horizontal: Story = {
  render: () => <HorizontalScrollAreaDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A scroll area with horizontal scrolling. Demonstrates how to create a horizontal carousel-like interface.',
      },
    },
  },
};

const DynamicContentScrollAreaDemo = () => {
  const [items, setItems] = useState<number[]>([1, 2, 3, 4, 5]);

  const addItem = () => {
    setItems((prev) => [...prev, prev.length + 1]);
  };

  const removeItem = () => {
    if (items.length > 1) {
      setItems((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Button onClick={addItem} variant="outline" size="sm">
          Add Item
        </Button>
        <Button onClick={removeItem} variant="outline" size="sm">
          Remove Item
        </Button>
      </div>
      <ScrollArea className="h-[200px] w-[350px] rounded-md border p-4">
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item} className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
              Dynamic Item {item}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export const DynamicContent: Story = {
  render: () => <DynamicContentScrollAreaDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A scroll area with dynamically changing content. Shows how to handle content that changes over time.',
      },
    },
  },
};
