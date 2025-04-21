import type { Meta, StoryObj } from '@storybook/react';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '../../../src/components/ui/context-menu';

const meta: Meta<typeof ContextMenu> = {
  title: 'Components/ContextMenu',
  component: ContextMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A context menu component built on top of Radix UI's Context Menu primitive, providing a way to display a menu of actions when right-clicking on an element.

## Features
- Right-click activation
- Keyboard navigation
- Nested submenus
- Checkbox items
- Radio items
- Shortcuts
- Labels and separators
- Customizable styling
- Dark mode compatible
- Accessible by default

## Subcomponents
- \`ContextMenu\`: The root container component
- \`ContextMenuTrigger\`: The element that triggers the context menu
- \`ContextMenuContent\`: The menu content container
- \`ContextMenuItem\`: A menu item
- \`ContextMenuCheckboxItem\`: A checkbox menu item
- \`ContextMenuRadioItem\`: A radio menu item
- \`ContextMenuRadioGroup\`: A group of radio menu items
- \`ContextMenuSub\`: A submenu container
- \`ContextMenuSubTrigger\`: The trigger for a submenu
- \`ContextMenuSubContent\`: The content for a submenu
- \`ContextMenuLabel\`: A label for a group of menu items
- \`ContextMenuSeparator\`: A separator between menu items
- \`ContextMenuShortcut\`: A shortcut key indicator

## Accessibility
- WAI-ARIA compliant context menu pattern
- Keyboard navigation (Arrow keys, Enter, Space, Esc)
- Focus management
- Proper ARIA states
- Screen reader announcements
- Focus visible indicators

## Usage Guidelines
- Use for contextual actions
- Use for application menus
- Use for file operations
- Use for text editing
- Use for view options
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
      description: 'The controlled open state of the context menu',
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
    className: {
      description: 'Additional CSS classes to apply to the context menu',
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContextMenu>;

export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Cut</ContextMenuItem>
        <ContextMenuItem>Copy</ContextMenuItem>
        <ContextMenuItem>Paste</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Basic context menu with simple menu items.',
      },
    },
  },
};

export const WithSubmenu: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Cut</ContextMenuItem>
        <ContextMenuItem>Copy</ContextMenuItem>
        <ContextMenuItem>Paste</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>More Tools</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem>Save Page As...</ContextMenuItem>
            <ContextMenuItem>Create Shortcut...</ContextMenuItem>
            <ContextMenuItem>Name Window...</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>Developer Tools</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Context menu with a nested submenu demonstrating hierarchical navigation.',
      },
    },
  },
};

export const WithCheckboxes: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>View Options</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem checked>Show Line Numbers</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem>Show Minimap</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem>Show Status Bar</ContextMenuCheckboxItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Context menu with checkbox items for toggling view options.',
      },
    },
  },
};

export const WithRadioItems: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Theme</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuRadioGroup value="light">
          <ContextMenuRadioItem value="light">Light</ContextMenuRadioItem>
          <ContextMenuRadioItem value="dark">Dark</ContextMenuRadioItem>
          <ContextMenuRadioItem value="system">System</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Context menu with radio items for selecting a theme option.',
      },
    },
  },
};

export const WithShortcuts: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          Paste
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Context menu with keyboard shortcuts displayed for each action.',
      },
    },
  },
};
