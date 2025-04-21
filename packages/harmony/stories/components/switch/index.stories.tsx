import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Switch component is a toggle control that allows users to turn an option on or off. It provides a simple and intuitive way to control binary settings.

## Features
- Smooth transition animations
- Keyboard navigation support
- Focus management
- Disabled state support
- Custom styling options
- Accessible by default
- State management
- Label association

## Props
- \`checked\`: boolean - The checked state of the switch
- \`defaultChecked\`: boolean - The default checked state
- \`onCheckedChange\`: (checked: boolean) => void - Callback when checked state changes
- \`disabled\`: boolean - Whether the switch is disabled
- \`className\`: string - Additional CSS classes to apply

## Accessibility
- WAI-ARIA compliant
- Keyboard navigation (Space to toggle)
- Focus visible styles
- Screen reader support
- Proper ARIA attributes
- Label association
- State announcements

## Usage Guidelines
1. Use for binary settings
2. Provide clear labels
3. Consider default states
4. Handle state changes
5. Test keyboard navigation
6. Ensure proper contrast
7. Use consistent styling
8. Consider touch targets

## Best Practices
- Keep labels concise
- Use appropriate spacing
- Maintain visual hierarchy
- Consider mobile usage
- Test across devices
- Ensure responsive behavior
- Follow design system
- Handle edge cases

## Customization
- Adjust colors
- Modify dimensions
- Change border radius
- Add custom styles
- Modify animations
- Adjust opacity
- Customize focus styles
- Change background
`,
      },
    },
  },
  argTypes: {
    checked: {
      description: 'The checked state of the switch',
      control: 'boolean',
    },
    defaultChecked: {
      description: 'The default checked state',
      control: 'boolean',
    },
    onCheckedChange: {
      description: 'Callback when checked state changes',
      action: 'checked changed',
    },
    disabled: {
      description: 'Whether the switch is disabled',
      control: 'boolean',
    },
    className: {
      description: 'Additional CSS classes to apply',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

const SwitchDemo = () => {
  return (
    <div className="flex items-center space-x-2">
      <Switch id="airplane-mode" />
      <Label htmlFor="airplane-mode">Airplane Mode</Label>
    </div>
  );
};

export const Default: Story = {
  render: () => <SwitchDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A basic switch with a label. Demonstrates the default appearance and behavior of the switch component.',
      },
    },
  },
};

const SwitchWithStateDemo = () => {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center space-x-2">
        <Switch id="dark-mode" checked={checked} onCheckedChange={setChecked} />
        <Label htmlFor="dark-mode">Dark Mode</Label>
      </div>
      <p className="text-sm text-muted-foreground">Current state: {checked ? 'On' : 'Off'}</p>
      <Button variant="outline" size="sm" onClick={() => setChecked(!checked)}>
        Toggle
      </Button>
    </div>
  );
};

export const WithState: Story = {
  render: () => <SwitchWithStateDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A switch with controlled state management. Shows how to use the switch with React state and demonstrates the onCheckedChange callback.',
      },
    },
  },
};

const SwitchGroupDemo = () => {
  const [settings, setSettings] = useState({
    notifications: true,
    newsletter: false,
    offers: true,
  });

  const handleCheckedChange = (key: keyof typeof settings) => (checked: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: checked }));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Notification Settings</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications">Push Notifications</Label>
            <p className="text-sm text-muted-foreground">Receive notifications about account activity.</p>
          </div>
          <Switch
            id="notifications"
            checked={settings.notifications}
            onCheckedChange={handleCheckedChange('notifications')}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="newsletter">Email Newsletter</Label>
            <p className="text-sm text-muted-foreground">Receive our weekly newsletter.</p>
          </div>
          <Switch id="newsletter" checked={settings.newsletter} onCheckedChange={handleCheckedChange('newsletter')} />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="offers">Special Offers</Label>
            <p className="text-sm text-muted-foreground">Receive special offers and promotions.</p>
          </div>
          <Switch id="offers" checked={settings.offers} onCheckedChange={handleCheckedChange('offers')} />
        </div>
      </div>
    </div>
  );
};

export const Group: Story = {
  render: () => <SwitchGroupDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A group of switches for managing multiple settings. Demonstrates how to handle multiple switches with a single state object and shows a common use case for settings management.',
      },
    },
  },
};

const DisabledSwitchDemo = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch id="disabled-unchecked" disabled />
        <Label htmlFor="disabled-unchecked" className="text-muted-foreground">
          Disabled (Unchecked)
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="disabled-checked" disabled defaultChecked />
        <Label htmlFor="disabled-checked" className="text-muted-foreground">
          Disabled (Checked)
        </Label>
      </div>
    </div>
  );
};

export const Disabled: Story = {
  render: () => <DisabledSwitchDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Switches in disabled state. Shows both checked and unchecked disabled switches with appropriate styling and labels.',
      },
    },
  },
};
