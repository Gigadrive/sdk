import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader, LoadingPulse } from '@/components/ui/loading-pulse';
import { useState } from 'react';

const meta = {
  title: 'Components/LoadingPulse',
  component: LoadingPulse,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Loading Pulse component provides a smooth, animated loading indicator with a pulsing effect. It's perfect for indicating loading states in your application.

## Features
- Smooth pulse animation
- Customizable colors
- Adjustable sizes
- Flexible container
- Dark mode support
- Responsive design
- Accessibility features
- Custom styling options
- Multiple variants

## Props
- \`lineClassName\`: string - CSS class for the pulse lines
- \`className\`: string - Additional CSS classes for the container
- \`children\`: ReactNode - Custom content to wrap

## Subcomponents
- \`LoadingPulse\`: Main component with default styling
- \`Loader\`: Base component for custom implementations

## Accessibility
- ARIA roles and attributes
- Screen reader support
- Color contrast
- Semantic structure
- Reduced motion support
- Focus management
- Keyboard navigation
- Status announcements

## Usage Guidelines
1. Use for loading states
2. Keep animations subtle
3. Consider motion sensitivity
4. Provide context
5. Handle edge cases
6. Test across devices
7. Ensure proper contrast
8. Support screen readers

## Best Practices
- Keep animations smooth
- Use appropriate colors
- Consider performance
- Handle edge cases
- Test across devices
- Follow design system
- Document custom styles
- Consider motion preferences

## Customization
- Modify colors
- Adjust timing
- Change sizes
- Customize animations
- Modify spacing
- Adjust typography
- Change borders
- Customize transitions
`,
      },
    },
  },
  argTypes: {
    lineClassName: {
      description: 'CSS class for the pulse lines',
    },
    className: {
      description: 'Additional CSS classes for the container',
    },
    children: {
      description: 'Custom content to wrap',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LoadingPulse>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <LoadingPulse />,
  parameters: {
    docs: {
      description: {
        story:
          'A basic loading pulse with default styling and behavior. Demonstrates the core functionality of the component.',
      },
    },
  },
};

export const CustomColor: Story = {
  render: () => <LoadingPulse lineClassName="bg-blue-500" />,
  parameters: {
    docs: {
      description: {
        story: 'A loading pulse with custom color. Shows how to customize the appearance of the pulse lines.',
      },
    },
  },
};

export const LargeSize: Story = {
  render: () => <LoadingPulse className="scale-150" />,
  parameters: {
    docs: {
      description: {
        story: 'A larger loading pulse. Demonstrates how to adjust the size of the component.',
      },
    },
  },
};

export const SmallSize: Story = {
  render: () => <LoadingPulse className="scale-75" />,
  parameters: {
    docs: {
      description: {
        story: 'A smaller loading pulse. Shows how to create a more compact version of the component.',
      },
    },
  },
};

export const WithinButton: Story = {
  render: () => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = () => {
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 2000);
    };

    return (
      <Button onClick={handleClick} disabled={isLoading} className="min-w-[120px]">
        {isLoading ? <LoadingPulse className="scale-50" /> : 'Click Me'}
      </Button>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'A loading pulse within a button. Demonstrates how to use the component in interactive elements.',
      },
    },
  },
};

export const CustomLoader: Story = {
  render: () => (
    <Loader>
      <div className="line-scale-pulse-out">
        <div className="bg-red-500"></div>
        <div className="bg-yellow-500"></div>
        <div className="bg-green-500"></div>
        <div className="bg-blue-500"></div>
        <div className="bg-purple-500"></div>
      </div>
    </Loader>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A custom loader with multiple colors. Shows how to create a more personalized loading animation.',
      },
    },
  },
};

export const InCard: Story = {
  render: () => (
    <Card className="flex flex-col items-center justify-center">
      <CardHeader>
        <CardTitle className="text-lg font-medium">Loading Data</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <LoadingPulse />
        <CardDescription className="mt-4">Please wait while we fetch your data...</CardDescription>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A loading pulse within a card component. Demonstrates how to integrate the component into a larger UI context.',
      },
    },
  },
};
