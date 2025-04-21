import type { Meta, StoryObj } from '@storybook/react';

import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/components/ui/menubar';

const meta = {
  title: 'Components/Menubar',
  component: Menubar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Menubar component is a versatile navigation component that provides a horizontal menu bar with dropdown menus. It's built on top of Radix UI's Menubar primitive and offers a rich set of features for creating complex menu structures.

## Features
- Horizontal menu bar layout
- Nested submenus
- Checkbox and radio items
- Keyboard navigation
- Customizable styling
- Dark mode support
- Responsive design
- Type-safe props
- Accessible by default

## Subcomponents
- \`Menubar\`: The root container component
- \`MenubarMenu\`: Container for a menu and its trigger
- \`MenubarTrigger\`: The button that opens the menu
- \`MenubarContent\`: The content of the menu
- \`MenubarItem\`: A menu item
- \`MenubarCheckboxItem\`: A menu item with a checkbox
- \`MenubarRadioItem\`: A menu item with a radio button
- \`MenubarLabel\`: A label for a group of menu items
- \`MenubarSeparator\`: A visual separator between items
- \`MenubarShortcut\`: A keyboard shortcut indicator
- \`MenubarSub\`: A submenu container
- \`MenubarSubTrigger\`: The trigger for a submenu
- \`MenubarSubContent\`: The content of a submenu

## Accessibility
- WAI-ARIA compliant
- Keyboard navigation support
- Screen reader friendly
- Focus management
- ARIA attributes
- Role attributes

## Usage Guidelines
1. Use clear, concise labels
2. Group related items together
3. Use separators for visual organization
4. Include keyboard shortcuts where appropriate
5. Maintain consistent styling
6. Consider mobile responsiveness
7. Test with screen readers
8. Ensure proper focus management

## Best Practices
- Keep menu structures shallow
- Use consistent patterns
- Provide visual feedback
- Include keyboard shortcuts
- Maintain visual hierarchy
- Use appropriate spacing
- Consider touch targets
- Test across devices

## Customization
- Adjust colors and themes
- Modify spacing and sizing
- Customize animations
- Change typography
- Add custom icons
- Modify transitions
- Adjust focus styles
- Customize hover states
`,
      },
    },
  },
  argTypes: {
    className: {
      description: 'Additional CSS classes to apply to the menubar',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Menubar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New Tab <MenubarShortcut>⌘T</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            New Window <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled>New Incognito Window</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Share <MenubarShortcut>⌘S</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Print... <MenubarShortcut>⌘P</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Undo <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Cut <MenubarShortcut>⌘X</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Copy <MenubarShortcut>⌘C</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Paste <MenubarShortcut>⌘V</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Zoom In <MenubarShortcut>⌘+</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Zoom Out <MenubarShortcut>⌘-</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            Toggle Fullscreen <MenubarShortcut>⌘F</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A basic menubar with File, Edit, and View menus. Demonstrates common menu structure with shortcuts and separators.',
      },
    },
  },
};

export const WithSubmenu: Story = {
  render: () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger>Open...</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Recent Files</MenubarItem>
              <MenubarItem>From URL</MenubarItem>
              <MenubarItem>From Device</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem>
            Save <MenubarShortcut>⌘S</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Menubar with a nested submenu. Shows how to create hierarchical menu structures.',
      },
    },
  },
};

export const WithCheckboxes: Story = {
  render: () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel>Appearance</MenubarLabel>
          <MenubarCheckboxItem checked>Show Toolbar</MenubarCheckboxItem>
          <MenubarCheckboxItem>Show Sidebar</MenubarCheckboxItem>
          <MenubarCheckboxItem>Show Status Bar</MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarLabel>Layout</MenubarLabel>
          <MenubarCheckboxItem>Compact Mode</MenubarCheckboxItem>
          <MenubarCheckboxItem>Full Width</MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Menubar with checkbox items. Demonstrates how to create toggleable menu options.',
      },
    },
  },
};

export const WithRadioItems: Story = {
  render: () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>Theme</MenubarTrigger>
        <MenubarContent>
          <MenubarRadioGroup value="light">
            <MenubarLabel>Appearance</MenubarLabel>
            <MenubarRadioItem value="light">Light</MenubarRadioItem>
            <MenubarRadioItem value="dark">Dark</MenubarRadioItem>
            <MenubarRadioItem value="system">System</MenubarRadioItem>
          </MenubarRadioGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Menubar with radio items. Shows how to create mutually exclusive options.',
      },
    },
  },
};
