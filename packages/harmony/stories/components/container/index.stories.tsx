import type { Meta, StoryObj } from '@storybook/react';

import { Container } from '@/components/ui/container';

const meta = {
  title: 'Components/Container',
  component: Container,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Container component provides a responsive wrapper for content with consistent max-width and padding. It helps maintain a consistent layout across different screen sizes.

## Features
- Responsive max-width
- Consistent padding
- Customizable width
- Customizable padding
- Nested container support
- Dark mode support
- Custom styling options
- Flexible content area

## Props
- \`children\`: ReactNode - The content to be wrapped
- \`className\`: string - Additional CSS classes to apply

## Accessibility
- Semantic HTML structure
- Proper content flow
- Responsive design
- Screen reader support
- Focus management
- Color contrast

## Usage Guidelines
1. Use for page layouts
2. Maintain consistent spacing
3. Consider responsive behavior
4. Test across devices
5. Ensure proper contrast
6. Handle edge cases
7. Consider nested containers
8. Follow design system

## Best Practices
- Keep content organized
- Use appropriate sizing
- Maintain visual hierarchy
- Consider mobile usage
- Test across devices
- Ensure responsive behavior
- Follow design system
- Handle edge cases

## Customization
- Adjust max-width
- Modify padding
- Change background
- Add custom styles
- Modify borders
- Adjust spacing
- Customize shadows
- Change colors
`,
      },
    },
  },
  argTypes: {
    children: {
      description: 'The content to be wrapped',
    },
    className: {
      description: 'Additional CSS classes to apply',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Container>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Container className="bg-gray-100 dark:bg-gray-800 p-4 border border-dashed border-gray-300 dark:border-gray-600">
      <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
        <p className="dark:text-gray-100">Default container with max-width and padding</p>
      </div>
    </Container>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A basic container with default max-width and padding. Demonstrates the default appearance and behavior of the container component.',
      },
    },
  },
};

export const WithCustomWidth: Story = {
  render: () => (
    <Container className="max-w-3xl bg-gray-100 dark:bg-gray-800 p-4 border border-dashed border-gray-300 dark:border-gray-600">
      <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
        <p className="dark:text-gray-100">Container with custom max-width</p>
      </div>
    </Container>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A container with a custom max-width. Shows how to override the default max-width for different layout needs.',
      },
    },
  },
};

export const WithCustomPadding: Story = {
  render: () => (
    <Container className="bg-gray-100 dark:bg-gray-800 px-8 py-6 border border-dashed border-gray-300 dark:border-gray-600">
      <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
        <p className="dark:text-gray-100">Container with custom padding</p>
      </div>
    </Container>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A container with custom padding. Demonstrates how to adjust the padding for different spacing requirements.',
      },
    },
  },
};

export const WithContent: Story = {
  render: () => (
    <Container className="bg-gray-100 dark:bg-gray-800 p-4 border border-dashed border-gray-300 dark:border-gray-600">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="p-4 bg-white dark:bg-gray-700 rounded shadow-sm">
            <h3 className="font-medium dark:text-gray-100">Card {item}</h3>
            <p className="text-gray-500 dark:text-gray-300 text-sm mt-2">
              This is a card inside a container component.
            </p>
          </div>
        ))}
      </div>
    </Container>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A container with responsive grid content. Shows how to use the container with a responsive grid layout.',
      },
    },
  },
};

export const NestedContainers: Story = {
  render: () => (
    <Container className="bg-gray-100 dark:bg-gray-800 p-4 border border-dashed border-gray-300 dark:border-gray-600">
      <div className="p-4 bg-white dark:bg-gray-700 rounded shadow mb-4">
        <p className="dark:text-gray-100">Outer container</p>
      </div>
      <Container className="bg-blue-50 dark:bg-blue-900 border border-dashed border-blue-300 dark:border-blue-700">
        <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
          <p className="dark:text-gray-100">Nested container</p>
        </div>
      </Container>
    </Container>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Nested containers with different styles. Demonstrates how to nest containers and apply different styles to each level.',
      },
    },
  },
};
