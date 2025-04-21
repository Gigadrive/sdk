import type { Meta, StoryObj } from '@storybook/react';

import { Textarea } from '@/components/ui/textarea';

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Textarea component is a form control that allows users to enter multi-line text. It provides a simple and intuitive way to collect longer text input from users.

## Features
- Floating label support
- Error state handling
- Help text display
- Custom styling options
- Responsive design
- Focus management
- Disabled state
- Bottom element support

## Props
- \`label\`: string - The label text for the textarea
- \`error\`: string - Error message to display
- \`helpText\`: string - Helper text to display below the textarea
- \`bottomElement\`: ReactNode - Additional element to display below the textarea
- \`className\`: string - Additional CSS classes to apply
- \`disabled\`: boolean - Whether the textarea is disabled
- \`placeholder\`: string - Placeholder text
- \`value\`: string - The controlled value
- \`onChange\`: (event: React.ChangeEvent<HTMLTextAreaElement>) => void - Change handler

## Accessibility
- WAI-ARIA compliant
- Keyboard navigation
- Focus visible styles
- Screen reader support
- Proper ARIA attributes
- Label association
- Error announcements

## Usage Guidelines
1. Use for multi-line text input
2. Provide clear labels
3. Show validation errors
4. Add helpful descriptions
5. Consider character limits
6. Test keyboard navigation
7. Ensure proper contrast
8. Handle edge cases

## Best Practices
- Keep labels concise
- Use appropriate sizing
- Maintain visual hierarchy
- Consider mobile usage
- Test across devices
- Ensure responsive behavior
- Follow design system
- Handle validation

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
    label: {
      description: 'The label text for the textarea',
      control: 'text',
    },
    error: {
      description: 'Error message to display',
      control: 'text',
    },
    helpText: {
      description: 'Helper text to display below the textarea',
      control: 'text',
    },
    bottomElement: {
      description: 'Additional element to display below the textarea',
    },
    className: {
      description: 'Additional CSS classes to apply',
    },
    disabled: {
      description: 'Whether the textarea is disabled',
      control: 'boolean',
    },
    placeholder: {
      description: 'Placeholder text',
      control: 'text',
    },
    value: {
      description: 'The controlled value',
      control: 'text',
    },
    onChange: {
      description: 'Change handler',
      action: 'changed',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Textarea>;

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
          'A basic textarea with placeholder text. Demonstrates the default appearance and behavior of the textarea component.',
      },
    },
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Message',
    placeholder: 'Enter your message',
  },
  parameters: {
    docs: {
      description: {
        story: 'A textarea with a floating label. Shows how to add a label to the textarea for better user experience.',
      },
    },
  },
};

export const WithError: Story = {
  args: {
    label: 'Description',
    placeholder: 'Enter description',
    error: 'Description is required',
  },
  parameters: {
    docs: {
      description: {
        story:
          'A textarea with error state. Demonstrates how to display validation errors and style the textarea accordingly.',
      },
    },
  },
};

export const WithHelpText: Story = {
  args: {
    label: 'Bio',
    placeholder: 'Tell us about yourself',
    helpText: 'Write a short bio about yourself',
  },
  parameters: {
    docs: {
      description: {
        story: 'A textarea with helper text. Shows how to provide additional context or instructions to users.',
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Textarea',
    placeholder: 'This textarea is disabled',
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'A disabled textarea. Demonstrates the appearance and behavior of a textarea in a disabled state.',
      },
    },
  },
};
