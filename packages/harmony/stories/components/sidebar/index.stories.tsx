import type { Meta, StoryObj } from '@storybook/react';
import { Bell, FileText, Home, Mail, Search, Settings, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarBadge,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

const meta = {
  title: 'Components/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Sidebar component is a versatile navigation component that provides a collapsible side panel for your application. It's built with accessibility in mind and offers various customization options.

## Features
- Collapsible navigation panel
- Multiple variants (default, floating, inset)
- Mobile-responsive design
- Keyboard navigation
- Customizable styling
- Dark mode support
- Type-safe props
- Accessible by default
- Search functionality
- Nested navigation support
- Badge support
- User profile section

## Subcomponents
- \`SidebarProvider\`: Context provider for sidebar state
- \`Sidebar\`: The main sidebar container
- \`SidebarHeader\`: Header section of the sidebar
- \`SidebarContent\`: Main content area
- \`SidebarFooter\`: Footer section
- \`SidebarMenu\`: Container for menu items
- \`SidebarMenuItem\`: Individual menu item
- \`SidebarBadge\`: Badge component for menu items
- \`SidebarInput\`: Search input component
- \`SidebarTrigger\`: Toggle button for collapsing

## Accessibility
- WAI-ARIA compliant
- Keyboard navigation support
- Screen reader friendly
- Focus management
- ARIA attributes
- Role attributes
- Proper heading structure
- Semantic HTML

## Usage Guidelines
1. Choose appropriate variant
2. Use clear navigation labels
3. Maintain consistent styling
4. Consider mobile responsiveness
5. Test with screen readers
6. Ensure proper focus management
7. Use appropriate spacing
8. Keep navigation organized

## Best Practices
- Keep navigation focused
- Use consistent patterns
- Provide visual feedback
- Maintain visual hierarchy
- Use appropriate spacing
- Consider touch targets
- Test across devices
- Ensure responsive behavior

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
    variant: {
      description: 'The visual style of the sidebar',
      control: 'select',
      options: ['sidebar', 'floating', 'inset'],
    },
    collapsible: {
      description: 'How the sidebar collapses',
      control: 'select',
      options: ['offcanvas', 'icon', 'none'],
    },
    side: {
      description: 'Which side the sidebar appears on',
      control: 'select',
      options: ['left', 'right'],
    },
    hoverExpand: {
      description: 'Whether the sidebar expands on hover',
      control: 'boolean',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const SidebarDemo = () => {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 px-4 py-2">
              <div className="h-6 w-6 rounded-md bg-emerald-500" />
              <span className="text-lg font-medium">My App</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2">
            <div className="relative mb-4">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <SidebarInput className="pl-8 w-full bg-secondary" placeholder="Search..." />
            </div>
            <SidebarMenu>
              <SidebarMenuItem icon={<Home className="h-4 w-4" />} title="Dashboard" isActive />
              <SidebarMenuItem icon={<Users className="h-4 w-4" />} title="Users">
                <SidebarBadge className="bg-secondary">12</SidebarBadge>
              </SidebarMenuItem>
              <SidebarMenuItem icon={<Mail className="h-4 w-4" />} title="Messages">
                <SidebarBadge className="bg-secondary">5</SidebarBadge>
              </SidebarMenuItem>
              <SidebarMenuItem icon={<FileText className="h-4 w-4" />} title="Documents">
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6">
                  <Bell className="h-4 w-4" />
                </Button>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarMenu label="Settings">
              <SidebarMenuItem icon={<Settings className="h-4 w-4" />} title="Account" />
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-3 p-4">
              <div className="h-8 w-8 rounded-full bg-secondary" />
              <div>
                <p className="text-sm font-medium">John Doe</p>
                <p className="text-xs text-muted-foreground">john@example.com</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 p-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Welcome to your dashboard</p>
        </div>
      </div>
    </SidebarProvider>
  );
};

export const Default: Story = {
  render: () => <SidebarDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A basic sidebar with navigation items, search, and user profile. Demonstrates common usage with header, content, and footer sections.',
      },
    },
  },
};

const CollapsibleSidebarContent = () => {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-4 py-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            <div className="h-6 w-6 rounded-md bg-emerald-500 shrink-0" />
            <span className="text-lg font-medium truncate group-data-[collapsible=icon]:hidden">My App</span>
            <SidebarTrigger className="ml-auto h-6 w-6 shrink-0 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:mt-2" />
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2">
          <div className="relative mb-4 group-data-[collapsible=icon]:hidden">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <SidebarInput className="pl-8 w-full bg-secondary" placeholder="Search..." />
          </div>
          <SidebarMenu>
            <SidebarMenuItem
              icon={<Home className="h-4 w-4 shrink-0" />}
              title="Dashboard"
              isActive
              tooltip="Dashboard"
            />
            <SidebarMenuItem icon={<Users className="h-4 w-4 shrink-0" />} title="Users" tooltip="Users">
              <SidebarBadge className="bg-secondary group-data-[collapsible=icon]:hidden">12</SidebarBadge>
            </SidebarMenuItem>
            <SidebarMenuItem icon={<Mail className="h-4 w-4 shrink-0" />} title="Messages" tooltip="Messages">
              <SidebarBadge className="bg-secondary group-data-[collapsible=icon]:hidden">5</SidebarBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-3 p-4 group-data-[collapsible=icon]:justify-center">
            <div className="h-8 w-8 rounded-full bg-secondary shrink-0" />
            <div className="group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium">John Doe</p>
              <p className="text-xs text-muted-foreground">john@example.com</p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1 p-8">
        <Button onClick={toggleSidebar} variant="outline" className="mb-4">
          Toggle Sidebar
        </Button>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Try collapsing the sidebar using the button above or the toggle in the sidebar
        </p>
      </div>
    </div>
  );
};

const CollapsibleSidebarDemo = () => {
  return (
    <SidebarProvider>
      <CollapsibleSidebarContent />
    </SidebarProvider>
  );
};

export const Collapsible: Story = {
  render: () => <CollapsibleSidebarDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A collapsible sidebar that can be toggled between expanded and icon-only states. Demonstrates responsive behavior and state management.',
      },
    },
  },
};

const FloatingSidebarContent = () => {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex h-screen w-full bg-muted/20">
      <Sidebar variant="floating" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-4 py-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            <div className="h-6 w-6 rounded-md bg-emerald-500 shrink-0" />
            <span className="text-lg font-medium truncate group-data-[collapsible=icon]:hidden">My App</span>
            <SidebarTrigger className="ml-auto h-6 w-6 shrink-0 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:mt-2" />
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2">
          <SidebarMenu>
            <SidebarMenuItem icon={<Home className="h-4 w-4" />} title="Dashboard" isActive tooltip="Dashboard" />
            <SidebarMenuItem icon={<Users className="h-4 w-4" />} title="Users" tooltip="Users" />
            <SidebarMenuItem icon={<Settings className="h-4 w-4" />} title="Settings" tooltip="Settings" />
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <div className="flex-1 p-8">
        <Button onClick={toggleSidebar} variant="outline" className="mb-4">
          Toggle Sidebar
        </Button>
        <h1 className="text-2xl font-bold">Floating Sidebar</h1>
        <p className="mt-2 text-muted-foreground">This sidebar has a floating style with rounded corners and shadow</p>
      </div>
    </div>
  );
};

const FloatingSidebarDemo = () => {
  return (
    <SidebarProvider>
      <FloatingSidebarContent />
    </SidebarProvider>
  );
};

export const Floating: Story = {
  render: () => <FloatingSidebarDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A floating sidebar with a distinct visual style. Demonstrates the floating variant with rounded corners and shadow effects.',
      },
    },
  },
};

const SidebarWithSubmenuContent = () => {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="h-6 w-6 rounded-md bg-emerald-500" />
            <span className="text-lg font-medium">My App</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2">
          <SidebarMenu>
            <SidebarMenuItem icon={<Home className="h-4 w-4" />} title="Dashboard" isActive />
            <SidebarMenuItem icon={<Users className="h-4 w-4" />} title="Users">
              <SidebarMenu>
                <SidebarMenuItem title="All Users" />
                <SidebarMenuItem title="Active Users" />
                <SidebarMenuItem title="Inactive Users" />
              </SidebarMenu>
            </SidebarMenuItem>
            <SidebarMenuItem icon={<Settings className="h-4 w-4" />} title="Settings">
              <SidebarMenu>
                <SidebarMenuItem title="Account" />
                <SidebarMenuItem title="Preferences" />
                <SidebarMenuItem title="Security" />
              </SidebarMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold">Nested Navigation</h1>
        <p className="mt-2 text-muted-foreground">This sidebar demonstrates nested navigation with submenus</p>
      </div>
    </div>
  );
};

const SidebarWithSubmenuDemo = () => {
  return (
    <SidebarProvider>
      <SidebarWithSubmenuContent />
    </SidebarProvider>
  );
};

export const WithSubmenu: Story = {
  render: () => <SidebarWithSubmenuDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A sidebar with nested navigation using submenus. Demonstrates how to create hierarchical navigation structures.',
      },
    },
  },
};
