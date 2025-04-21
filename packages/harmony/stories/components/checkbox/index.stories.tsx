import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A checkbox component built on top of Radix UI Checkbox primitive, providing a way to select one or multiple options.

## Features
- Controlled and uncontrolled modes
- Customizable size
- Disabled state support
- Label integration
- Focus management
- Keyboard navigation
- Custom styling support
- Dark mode compatible

## Accessibility
- WAI-ARIA compliant checkbox pattern
- Keyboard navigation (Space to toggle)
- Focus visible indicators
- Proper ARIA states
- Screen reader announcements
- Label association
- Disabled state handling

## Usage Guidelines
- Use for binary choices
- Use in forms for multiple selections
- Use with clear, concise labels
- Use in lists of options
- Consider grouping related checkboxes
- Maintain consistent spacing
- Provide clear feedback

## Best Practices
- Always provide labels
- Use clear, actionable text
- Group related checkboxes
- Consider default states
- Maintain consistent sizing
- Use appropriate spacing
- Provide visual feedback
- Consider mobile touch targets

## States
- Unchecked
- Checked
- Indeterminate
- Disabled
- Focused
- Hovered

## Props
- \`checked\`: Controlled checked state
- \`defaultChecked\`: Default checked state
- \`onCheckedChange\`: Change handler
- \`disabled\`: Disabled state
- \`required\`: Required field
- \`name\`: Form field name
- \`value\`: Form field value
- \`className\`: Additional CSS classes

## Customization
- Size adjustments
- Color schemes
- Border styles
- Check icon
- Focus styles
- Spacing
- Animation
`,
      },
    },
  },
  argTypes: {
    checked: {
      description: 'The controlled checked state of the checkbox',
      control: 'boolean',
    },
    defaultChecked: {
      description: 'The default checked state when uncontrolled',
      control: 'boolean',
    },
    disabled: {
      description: 'Whether the checkbox is disabled',
      control: 'boolean',
    },
    required: {
      description: 'Whether the checkbox is required',
      control: 'boolean',
    },
    className: {
      description: 'Additional CSS classes to apply to the checkbox',
      control: 'text',
    },
    onCheckedChange: {
      description: 'Callback when the checked state changes',
      control: 'function',
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Checkbox />,
  parameters: {
    docs: {
      description: {
        story: 'Basic checkbox without any additional styling or labels.',
      },
    },
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Checkbox with an associated label using the Label component.',
      },
    },
  },
};

export const Checked: Story = {
  render: () => <Checkbox defaultChecked />,
  parameters: {
    docs: {
      description: {
        story: 'Checkbox in its checked state using the defaultChecked prop.',
      },
    },
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <Checkbox disabled />
        <Label className="text-muted-foreground">Disabled</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox disabled defaultChecked />
        <Label className="text-muted-foreground">Disabled checked</Label>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Disabled checkboxes in both checked and unchecked states.',
      },
    },
  },
};

const CheckboxWithState = () => {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} id="controlled" />
        <Label htmlFor="controlled">{checked ? 'Checked' : 'Unchecked'}</Label>
      </div>
      <div className="text-sm text-muted-foreground">The checkbox is {checked ? 'checked' : 'unchecked'}</div>
    </div>
  );
};

export const Controlled: Story = {
  render: () => <CheckboxWithState />,
  parameters: {
    docs: {
      description: {
        story: 'Controlled checkbox example showing state management with React useState.',
      },
    },
  },
};

export const CustomSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="flex items-center space-x-2">
        <Checkbox className="h-3 w-3" id="small" />
        <Label htmlFor="small">Small</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="default" />
        <Label htmlFor="default">Default</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox className="h-5 w-5" id="large" />
        <Label htmlFor="large">Large</Label>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different checkbox sizes achieved through className customization.',
      },
    },
  },
};

export const FormExample: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <div className="flex items-center space-x-2">
        <Checkbox id="marketing" />
        <Label htmlFor="marketing">Marketing emails</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="newsletter" defaultChecked />
        <Label htmlFor="newsletter">Newsletter</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="offers" />
        <Label htmlFor="offers">Special offers</Label>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of checkboxes in a form context with multiple options.',
      },
    },
  },
};
