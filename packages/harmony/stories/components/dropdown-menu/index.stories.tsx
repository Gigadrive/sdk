import type { Meta, StoryObj } from '@storybook/react';
import { CreditCard, LogOut, Settings, User } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A dropdown menu component built on top of Radix UI's Dropdown Menu primitive, providing a way to display a menu of actions when clicking on a trigger element.

## Features
- Click activation
- Keyboard navigation
- Nested submenus
- Checkbox items
- Radio items
- Shortcuts
- Labels and separators
- Customizable styling
- Dark mode compatible
- Accessible by default
- Inset items support
- Icon integration
- Animation support

## Subcomponents
- \`DropdownMenu\`: The root container component
- \`DropdownMenuTrigger\`: The button that opens the dropdown menu
- \`DropdownMenuContent\`: The menu content container
- \`DropdownMenuItem\`: A menu item
- \`DropdownMenuCheckboxItem\`: A checkbox menu item
- \`DropdownMenuRadioItem\`: A radio menu item
- \`DropdownMenuRadioGroup\`: A group of radio menu items
- \`DropdownMenuSub\`: A submenu container
- \`DropdownMenuSubTrigger\`: The trigger for a submenu
- \`DropdownMenuSubContent\`: The content for a submenu
- \`DropdownMenuLabel\`: A label for a group of menu items
- \`DropdownMenuSeparator\`: A separator between menu items
- \`DropdownMenuShortcut\`: A shortcut key indicator
- \`DropdownMenuGroup\`: A group of menu items
- \`DropdownMenuPortal\`: The portal for rendering the menu

## Accessibility
- WAI-ARIA compliant dropdown menu pattern
- Keyboard navigation (Arrow keys, Enter, Space, Esc)
- Focus management
- Proper ARIA states
- Screen reader announcements
- Focus visible indicators

## Usage Guidelines
- Use for navigation
- Use for actions
- Use for settings
- Use for filters
- Use for sorting
- Consider mobile alternatives
- Maintain consistent behavior

## Best Practices
- Group related actions
- Use clear, concise labels
- Provide keyboard shortcuts
- Use appropriate icons
- Consider menu depth
- Maintain consistent styling
- Use separators for grouping
- Consider touch devices

## Props
- \`open\`: Controlled open state
- \`defaultOpen\`: Default open state
- \`onOpenChange\`: Change handler
- \`inset\`: Whether to inset the item
- \`className\`: Additional CSS classes

## Customization
- Custom animations
- Custom triggers
- Custom content styling
- Icon customization
- Spacing adjustments
- Border styles
- Background colors
- Typography
`,
      },
    },
  },
  argTypes: {
    open: {
      description: 'The controlled open state of the dropdown menu',
      control: 'boolean',
    },
    defaultOpen: {
      description: 'The default open state when uncontrolled',
      control: 'boolean',
    },
    onOpenChange: {
      description: 'Callback when the open state changes',
      control: 'function',
    },
    inset: {
      description: 'Whether to inset the item',
      control: 'boolean',
    },
    className: {
      description: 'Additional CSS classes to apply to the dropdown menu',
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const DropdownMenuDemo = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Billing</span>
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Default: Story = {
  render: () => <DropdownMenuDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Basic dropdown menu with icons and keyboard shortcuts.',
      },
    },
  },
};

const DropdownMenuCheckboxDemo = () => {
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [showActivityBar, setShowActivityBar] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open Checkbox Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={showStatusBar} onCheckedChange={setShowStatusBar}>
          Status Bar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showActivityBar} onCheckedChange={setShowActivityBar}>
          Activity Bar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showPanel} onCheckedChange={setShowPanel}>
          Panel
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const WithCheckboxes: Story = {
  render: () => <DropdownMenuCheckboxDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Dropdown menu with checkbox items for toggling options.',
      },
    },
  },
};

const DropdownMenuRadioDemo = () => {
  const [position, setPosition] = useState('bottom');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open Radio Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Panel Position</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={position} onValueChange={setPosition}>
          <DropdownMenuRadioItem value="top">Top</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="bottom">Bottom</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="right">Right</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const WithRadioItems: Story = {
  render: () => <DropdownMenuRadioDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Dropdown menu with radio items for selecting a single option.',
      },
    },
  },
};

const DropdownMenuSubMenuDemo = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open Menu with Submenu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem>
                  <span>General</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Security</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Notifications</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const WithSubMenu: Story = {
  render: () => <DropdownMenuSubMenuDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Dropdown menu with a nested submenu for additional options.',
      },
    },
  },
};

const DropdownMenuInsetDemo = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open Inset Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Navigation</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem inset>Home</DropdownMenuItem>
        <DropdownMenuItem inset>Dashboard</DropdownMenuItem>
        <DropdownMenuItem inset>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel inset>Help</DropdownMenuLabel>
        <DropdownMenuItem inset>Documentation</DropdownMenuItem>
        <DropdownMenuItem inset>Support</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const WithInsetItems: Story = {
  render: () => <DropdownMenuInsetDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Dropdown menu with inset items for hierarchical navigation.',
      },
    },
  },
};
