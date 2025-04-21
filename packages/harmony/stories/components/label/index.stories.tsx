import type { Meta, StoryObj } from '@storybook/react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const meta = {
  title: 'Components/Label',
  component: Label,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Label component is a fundamental form element that provides accessible labels for form controls. It's built on top of Radix UI's Label primitive and ensures proper association between labels and their form controls.

## Features
- Accessible by default
- Proper form control association
- Disabled state support
- Customizable styling
- Dark mode support
- Responsive design
- Type-safe props
- Flexible positioning

## Props
- \`htmlFor\`: ID of the form control to associate with the label
- \`className\`: Additional CSS classes
- All standard HTML label props

## Accessibility
- Proper label-control association
- Screen reader support
- Keyboard navigation
- ARIA attributes
- Disabled state handling

## Usage Guidelines
1. Always associate labels with form controls using htmlFor
2. Keep labels concise and clear
3. Use appropriate font sizes and weights
4. Maintain consistent styling
5. Consider mobile readability

## Best Practices
- Write clear, descriptive labels
- Use proper HTML semantics
- Maintain visual hierarchy
- Ensure sufficient contrast
- Keep labels visible
- Use consistent spacing
- Consider form layout
- Test with screen readers

## Customization
- Adjust font size
- Modify font weight
- Change text color
- Customize spacing
- Add custom styles
- Modify disabled state
- Change focus styles
- Adjust line height
`,
      },
    },
  },
  argTypes: {
    htmlFor: {
      description: 'ID of the form control to associate with the label',
      control: 'text',
    },
    className: {
      description: 'Additional CSS classes to apply to the label',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="Enter your email" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A basic label associated with an input field. Demonstrates proper label-input association.',
      },
    },
  },
};

export const WithCheckbox: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Label associated with a checkbox. Shows how to create accessible checkbox groups.',
      },
    },
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="disabled-input" className="text-gray-500">
        Disabled Input
      </Label>
      <Input id="disabled-input" disabled placeholder="This input is disabled" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Label with a disabled input. Demonstrates how labels appear when associated with disabled controls.',
      },
    },
  },
};

export const Required: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="required-input">
        Required Field <span className="text-red-500">*</span>
      </Label>
      <Input id="required-input" placeholder="This field is required" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Label indicating a required field. Shows how to visually indicate mandatory form fields.',
      },
    },
  },
};

export const WithHelpText: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="password">Password</Label>
      <Input type="password" id="password" placeholder="Enter your password" />
      <p className="text-sm text-gray-500">Must be at least 8 characters long</p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Label with help text. Demonstrates how to provide additional context below the label.',
      },
    },
  },
};
