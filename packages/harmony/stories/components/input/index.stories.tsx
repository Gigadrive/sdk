import type { Meta, StoryObj } from '@storybook/react';

import { Input } from '@/components/ui/input';

const meta = {
  title: 'Components/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Input component is a versatile form control that provides a text input field with various features and customization options.

## Features
- Floating label support
- Error state handling
- Help text display
- Left/right element slots
- Bottom element slot
- Dark mode support
- Responsive design
- Accessibility features
- Custom styling options
- Form validation support

## Props
- \`label\`: string - Floating label text
- \`error\`: string - Error message to display
- \`leftElement\`: ReactNode - Element to show on the left side
- \`rightElement\`: ReactNode - Element to show on the right side
- \`bottomElement\`: ReactNode - Element to show below the input
- \`helpText\`: string - Helper text to display below the input
- \`type\`: string - Input type (text, password, email, etc.)
- \`disabled\`: boolean - Whether the input is disabled
- \`className\`: string - Additional CSS classes

## Accessibility
- ARIA labels and descriptions
- Error state announcements
- Keyboard navigation
- Focus management
- Screen reader support
- Color contrast
- Semantic structure

## Usage Guidelines
1. Always provide a label
2. Use appropriate input types
3. Handle validation states
4. Provide clear error messages
5. Consider mobile usage
6. Test keyboard navigation
7. Ensure proper contrast
8. Support screen readers

## Best Practices
- Keep labels concise
- Use clear placeholder text
- Provide helpful error messages
- Handle edge cases
- Test across devices
- Consider performance
- Follow design system
- Document custom elements

## Customization
- Modify colors
- Adjust spacing
- Change typography
- Customize borders
- Modify focus states
- Adjust animations
- Change icons
- Customize error states
`,
      },
    },
  },
  argTypes: {
    label: {
      description: 'Floating label text',
    },
    error: {
      description: 'Error message to display',
    },
    leftElement: {
      description: 'Element to show on the left side',
    },
    rightElement: {
      description: 'Element to show on the right side',
    },
    bottomElement: {
      description: 'Element to show below the input',
    },
    helpText: {
      description: 'Helper text to display below the input',
    },
    type: {
      description: 'Input type (text, password, email, etc.)',
    },
    disabled: {
      description: 'Whether the input is disabled',
    },
    className: {
      description: 'Additional CSS classes',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
  parameters: {
    docs: {
      description: {
        story:
          'A basic input field with default styling and behavior. Demonstrates the core functionality of the component.',
      },
    },
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Email',
    placeholder: 'Enter your email',
  },
  parameters: {
    docs: {
      description: {
        story: 'An input field with a floating label. Shows how to add descriptive labels to inputs.',
      },
    },
  },
};

export const WithError: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
    error: 'This username is already taken',
  },
  parameters: {
    docs: {
      description: {
        story: 'An input field with error state. Demonstrates how to display validation errors.',
      },
    },
  },
};

export const WithHelpText: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter password',
    helpText: 'Password must be at least 8 characters long',
  },
  parameters: {
    docs: {
      description: {
        story: 'An input field with helper text. Shows how to provide additional context or instructions.',
      },
    },
  },
};

export const WithLeftElement: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search...',
    leftElement: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-gray-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'An input field with a left icon. Demonstrates how to add decorative or functional elements to the left side.',
      },
    },
  },
};

export const WithRightElement: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter password',
    rightElement: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-gray-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'An input field with a right icon. Shows how to add decorative or functional elements to the right side.',
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Input',
    placeholder: 'This input is disabled',
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'A disabled input field. Demonstrates the disabled state styling and behavior.',
      },
    },
  },
};
