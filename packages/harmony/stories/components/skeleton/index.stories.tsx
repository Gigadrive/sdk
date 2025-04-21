import type { Meta, StoryObj } from '@storybook/react';

import { Skeleton } from '@/components/ui/skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Components/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Skeleton component provides a loading state placeholder that mimics the structure of the content being loaded. It uses a subtle animation to indicate loading status and helps maintain layout stability during content loading.

## Features
- Animated pulse effect
- Customizable dimensions
- Flexible styling
- Dark mode support
- Responsive design
- Layout preservation
- Accessibility support
- Performance optimized

## Props
- \`className\`: string - Additional CSS classes for styling
- \`children\`: ReactNode - Optional content to display within the skeleton
- \`style\`: CSSProperties - Inline styles
- \`...props\`: HTMLAttributes - Additional HTML attributes

## Accessibility
- ARIA roles and attributes
- Screen reader support
- Color contrast
- Reduced motion support
- Semantic structure
- Focus management
- Keyboard navigation
- Loading state indication

## Usage Guidelines
1. Match content structure
2. Use appropriate dimensions
3. Maintain layout stability
4. Consider loading time
5. Test across devices
6. Ensure proper contrast
7. Support reduced motion
8. Follow design system

## Best Practices
- Keep skeletons simple
- Match content layout
- Use consistent sizing
- Consider loading time
- Test across devices
- Follow design system
- Document custom styles
- Consider performance

## Customization
- Modify colors
- Adjust dimensions
- Change animation
- Customize borders
- Adjust spacing
- Modify opacity
- Change transitions
- Customize shapes
`,
      },
    },
  },
  argTypes: {
    className: {
      description: 'Additional CSS classes for styling',
    },
    children: {
      description: 'Optional content to display within the skeleton',
    },
    style: {
      description: 'Inline styles',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const SkeletonDemo = () => {
  return (
    <div className="flex flex-col space-y-3">
      <Skeleton className="h-[125px] w-[250px] rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
  );
};

export const Default: Story = {
  render: () => <SkeletonDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A basic skeleton with default styling and animation. Demonstrates the core functionality of the component.',
      },
    },
  },
};

const CardSkeletonDemo = () => {
  return (
    <div className="flex flex-col space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-5 w-[150px]" />
        <Skeleton className="h-4 w-[250px]" />
      </div>
      <Skeleton className="h-[125px] w-[250px] rounded-xl" />
      <div className="flex items-center space-x-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-[100px]" />
          <Skeleton className="h-3 w-[70px]" />
        </div>
      </div>
    </div>
  );
};

export const Card: Story = {
  render: () => <CardSkeletonDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A skeleton layout mimicking a card component. Shows how to create complex loading states for card-based content.',
      },
    },
  },
};

const ProfileSkeletonDemo = () => {
  return (
    <div className="flex items-center space-x-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[150px]" />
        <Skeleton className="h-4 w-[100px]" />
      </div>
    </div>
  );
};

export const Profile: Story = {
  render: () => <ProfileSkeletonDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A skeleton layout for a user profile. Demonstrates how to create loading states for profile information.',
      },
    },
  },
};

const FormSkeletonDemo = () => {
  return (
    <div className="w-[350px] space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-[80px]" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[120px]" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-10 w-[100px]" />
    </div>
  );
};

export const Form: Story = {
  render: () => <FormSkeletonDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A skeleton layout for a form. Shows how to create loading states for form inputs and labels.',
      },
    },
  },
};

const TableSkeletonDemo = () => {
  return (
    <div className="w-[600px] space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-8 w-[120px]" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-3 w-[100px]" />
              </div>
            </div>
            <Skeleton className="h-8 w-[80px]" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const Table: Story = {
  render: () => <TableSkeletonDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A skeleton layout for a table. Demonstrates how to create loading states for tabular data with multiple rows.',
      },
    },
  },
};
