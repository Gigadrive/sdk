import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Toolbar, ToolbarButton, ToolbarMenu, ToolbarMenuItem } from '@/components/ui/toolbar';
import type { Meta, StoryObj } from '@storybook/react';
import { MoreHorizontal, Search, User } from 'lucide-react';

const meta: Meta<typeof Toolbar> = {
  title: 'Components/Toolbar',
  component: Toolbar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Toolbar component is a floating, highly composable action bar for your application. It provides a set of icon buttons and menus, with pre-defined floating positions and seamless integration with the Sidebar component.

## Features
- Floating toolbar with pre-defined positions (e.g., bottom-center, top-right)
- Simple, type-safe API
- ToolbarButton for clickable icon actions
- ToolbarMenu for dropdown actions
- ToolbarMenuItem for menu actions (no need to use <button> or Tailwind classes)
- Optional integration with Sidebar state (show only when sidebar is closed)
- No Tailwind required for basic use
- Accessible and keyboard-friendly
- Dark mode support

## Subcomponents
- **Toolbar**: The floating container
- **ToolbarButton**: An icon button
- **ToolbarMenu**: A button that opens a dropdown menu
- **ToolbarMenuItem**: A menu action button for use inside ToolbarMenu

## Usage Guidelines
- Use for quick access to primary or contextual actions
- Place in a floating position that does not obscure content
- Integrate with Sidebar for responsive layouts
- Use clear, recognizable icons
- Group related actions together
- Use **ToolbarMenuItem** for all menu actions inside ToolbarMenu

## Accessibility
- All buttons are focusable and keyboard accessible
- ARIA attributes are applied where appropriate
- Works with screen readers

## Customization
- Change position with the **position** prop
- Show/hide based on sidebar state with **showWhenSidebarClosed**
- Add custom icon buttons or menus
- Style with the **className** prop if needed
        `,
      },
    },
  },
  argTypes: {
    position: {
      description: 'Floating position of the toolbar',
      control: 'select',
      options: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'bottom-center', 'top-center'],
    },
    showWhenSidebarClosed: {
      description: 'Show toolbar only when sidebar is closed',
      control: 'boolean',
    },
    className: {
      description: 'Additional CSS classes for the toolbar',
    },
    direction: {
      description: 'Layout direction of the toolbar',
      control: 'radio',
      options: ['horizontal', 'vertical'],
    },
    size: {
      description: 'Size of the toolbar (controls padding, gap, border-radius)',
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    offset: {
      description: 'Offset from the edge (px, rem, or string)',
      control: 'text',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <SidebarProvider>
        <Story />
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Toolbar {...args}>
      <ToolbarButton icon={<SidebarTrigger />} aria-label="Toggle sidebar" />
      <ToolbarButton icon={<Search />} aria-label="Search" onClick={() => alert('Search clicked!')} />
      <ToolbarMenu icon={<MoreHorizontal />} aria-label="More actions">
        <ToolbarMenuItem onClick={() => alert('Profile')}>Profile</ToolbarMenuItem>
        <ToolbarMenuItem onClick={() => alert('Settings')}>Settings</ToolbarMenuItem>
        <ToolbarMenuItem onClick={() => alert('Logout')}>Logout</ToolbarMenuItem>
      </ToolbarMenu>
      <ToolbarButton icon={<User />} aria-label="User" />
    </Toolbar>
  ),
  args: {
    position: 'bottom-center',
    showWhenSidebarClosed: false,
    direction: 'horizontal',
    size: 'md',
    offset: undefined,
    children: (
      <>
        <ToolbarButton icon={<SidebarTrigger />} aria-label="Toggle sidebar" />
        <ToolbarButton icon={<Search />} aria-label="Search" onClick={() => alert('Search clicked!')} />
        <ToolbarMenu icon={<MoreHorizontal />} aria-label="More actions">
          <ToolbarMenuItem onClick={() => alert('Profile')}>Profile</ToolbarMenuItem>
          <ToolbarMenuItem onClick={() => alert('Settings')}>Settings</ToolbarMenuItem>
          <ToolbarMenuItem onClick={() => alert('Logout')}>Logout</ToolbarMenuItem>
        </ToolbarMenu>
        <ToolbarButton icon={<User />} aria-label="User" />
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A floating toolbar with icon buttons and a dropdown menu. Integrates with the sidebar and supports floating positioning.',
      },
    },
  },
};

export const Vertical: Story = {
  render: (args) => (
    <Toolbar {...args} direction="vertical" position="bottom-right">
      <ToolbarButton icon={<SidebarTrigger />} aria-label="Toggle sidebar" />
      <ToolbarButton icon={<Search />} aria-label="Search" onClick={() => alert('Search clicked!')} />
      <ToolbarMenu icon={<MoreHorizontal />} aria-label="More actions">
        <ToolbarMenuItem onClick={() => alert('Profile')}>Profile</ToolbarMenuItem>
        <ToolbarMenuItem onClick={() => alert('Settings')}>Settings</ToolbarMenuItem>
        <ToolbarMenuItem onClick={() => alert('Logout')}>Logout</ToolbarMenuItem>
      </ToolbarMenu>
      <ToolbarButton icon={<User />} aria-label="User" />
    </Toolbar>
  ),
  args: {
    direction: 'vertical',
    position: 'bottom-right',
    showWhenSidebarClosed: false,
    children: (
      <>
        <ToolbarButton icon={<SidebarTrigger />} aria-label="Toggle sidebar" />
        <ToolbarButton icon={<Search />} aria-label="Search" onClick={() => alert('Search clicked!')} />
        <ToolbarMenu icon={<MoreHorizontal />} aria-label="More actions">
          <ToolbarMenuItem onClick={() => alert('Profile')}>Profile</ToolbarMenuItem>
          <ToolbarMenuItem onClick={() => alert('Settings')}>Settings</ToolbarMenuItem>
          <ToolbarMenuItem onClick={() => alert('Logout')}>Logout</ToolbarMenuItem>
        </ToolbarMenu>
        <ToolbarButton icon={<User />} aria-label="User" />
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'A vertical floating toolbar positioned at the bottom right.',
      },
    },
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    position: 'bottom-left',
    direction: 'horizontal',
    showWhenSidebarClosed: false,
    children: (
      <>
        <ToolbarButton icon={<SidebarTrigger />} aria-label="Toggle sidebar" />
        <ToolbarButton icon={<Search />} aria-label="Search" />
        <ToolbarMenu icon={<MoreHorizontal />} aria-label="More actions">
          <ToolbarMenuItem>Profile</ToolbarMenuItem>
          <ToolbarMenuItem>Settings</ToolbarMenuItem>
        </ToolbarMenu>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'A small toolbar in the bottom left.',
      },
    },
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    position: 'top-right',
    direction: 'horizontal',
    showWhenSidebarClosed: false,
    children: (
      <>
        <ToolbarButton icon={<SidebarTrigger />} aria-label="Toggle sidebar" />
        <ToolbarButton icon={<Search />} aria-label="Search" />
        <ToolbarMenu icon={<MoreHorizontal />} aria-label="More actions">
          <ToolbarMenuItem>Profile</ToolbarMenuItem>
          <ToolbarMenuItem>Settings</ToolbarMenuItem>
        </ToolbarMenu>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'A large toolbar in the top right.',
      },
    },
  },
};

export const WithOffset: Story = {
  args: {
    size: 'md',
    position: 'bottom-center',
    offset: '2rem',
    direction: 'horizontal',
    showWhenSidebarClosed: false,
    children: (
      <>
        <ToolbarButton icon={<SidebarTrigger />} aria-label="Toggle sidebar" />
        <ToolbarButton icon={<Search />} aria-label="Search" />
        <ToolbarMenu icon={<MoreHorizontal />} aria-label="More actions">
          <ToolbarMenuItem>Profile</ToolbarMenuItem>
          <ToolbarMenuItem>Settings</ToolbarMenuItem>
        </ToolbarMenu>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'A medium toolbar with a 2rem offset from the bottom.',
      },
    },
  },
};
