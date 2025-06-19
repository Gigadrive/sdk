import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/ui/button';
import { Navbar, NavbarActions } from '@/components/ui/navbar';
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSubItem,
} from '@/components/ui/sidebar';

const meta = {
  title: 'Components/Navbar',
  component: Navbar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Navbar component provides a responsive navigation bar for your application. It supports various features and customization options to create a professional and functional navigation experience.

## Features
- Responsive design
- Sidebar integration
- Logo placement options
- Size variants
- Dark mode support
- Custom styling options
- Mobile-friendly

## Props
- \`children\`: ReactNode - Content to display in the navbar
- \`showSidebar\`: boolean - Whether to show the sidebar trigger
- \`size\`: 'default' | 'sm' | 'lg' - Size variant of the navbar
- \`logo\`: ReactNode - Logo component or image
- \`logoPosition\`: 'left' | 'center' - Position of the logo
- \`className\`: string - Additional CSS classes

## Subcomponents
- \`NavbarLogo\`: Logo container component
- \`NavbarContent\`: Main content area (hidden on mobile)
- \`NavbarActions\`: Actions container with responsive layout

## Accessibility
- ARIA roles and attributes
- Keyboard navigation
- Screen reader support
- Color contrast
- Semantic structure
- Responsive design
- Mobile navigation

## Usage Guidelines
1. Keep navigation items organized
2. Use clear labels
3. Consider mobile layout
4. Handle responsive behavior
5. Test across devices
6. Ensure proper contrast
7. Support keyboard navigation
8. Follow design system

## Best Practices
- Keep navigation simple
- Use meaningful labels
- Consider mobile usage
- Handle edge cases
- Test across devices
- Follow design system
- Document custom styles
- Consider performance

## Customization
- Modify colors
- Adjust spacing
- Change typography
- Customize animations
- Modify borders
- Adjust shadows
- Change transitions
- Customize hover states
`,
      },
    },
  },
  argTypes: {
    children: {
      description: 'Content to display in the navbar',
    },
    showSidebar: {
      description: 'Whether to show the sidebar trigger',
    },
    size: {
      description: 'Size variant of the navbar',
    },
    logo: {
      description: 'Logo component or image',
    },
    logoPosition: {
      description: 'Position of the logo',
    },
    className: {
      description: 'Additional CSS classes',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Navbar>
      <NavbarActions>
        <Button size="sm" variant="ghost">
          Sign In
        </Button>
        <Button size="sm">Get Started</Button>
      </NavbarActions>
    </Navbar>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A basic navbar with default styling and behavior. Demonstrates the core functionality of the component.',
      },
    },
  },
};

export const WithSidebar: Story = {
  render: () => (
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col">
        <Navbar
          showSidebar
          size="lg"
          logo={
            <>
              <img
                src="https://static-cdn.gigadrivegroup.com/logos/gigadrive/Gigadrive/2023/Gigadrive Logo Text Primary@0.25x.png"
                alt="Gigadrive"
                className="inline-block dark:hidden h-full"
              />
              <img
                src="https://static-cdn.gigadrivegroup.com/logos/gigadrive/Gigadrive/2023/Gigadrive Logo Text White@0.25x.png"
                alt="Gigadrive"
                className="hidden dark:inline-block h-full"
              />
            </>
          }
          logoPosition="center"
        >
          <NavbarActions>
            <Button size="sm" variant="ghost">
              Sign In
            </Button>
            <Button size="sm">Get Started</Button>
          </NavbarActions>
        </Navbar>
        <div className="flex flex-1">
          <Sidebar variant="inset" className="top-[var(--header-height)] !h-[calc(100svh-var(--header-height))]!">
            <SidebarContent>
              <div className="p-4">Sidebar Content</div>
            </SidebarContent>
          </Sidebar>
          <SidebarInset className="flex flex-col">
            <div className="p-4">Main Content Area</div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A navbar with sidebar integration. Shows how to combine the navbar with a sidebar component for a complete navigation experience.',
      },
    },
  },
};

export const WithSidebarMobile: Story = {
  render: () => (
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col" mobileCollapse>
        <Navbar
          showSidebar="desktop"
          size="lg"
          logo={
            <>
              <img
                src="https://static-cdn.gigadrivegroup.com/logos/gigadrive/Gigadrive/2023/Gigadrive Logo Text Primary@0.25x.png"
                alt="Gigadrive"
                className="inline-block dark:hidden h-full"
              />
              <img
                src="https://static-cdn.gigadrivegroup.com/logos/gigadrive/Gigadrive/2023/Gigadrive Logo Text White@0.25x.png"
                alt="Gigadrive"
                className="hidden dark:inline-block h-full"
              />
            </>
          }
          logoPosition="center"
        >
          <NavbarActions>
            <Button size="sm" variant="ghost">
              Sign In
            </Button>
            <Button size="sm">Get Started</Button>
          </NavbarActions>
        </Navbar>
        <div className="flex flex-1">
          <Sidebar variant="inset" className="top-[var(--header-height)] !h-[calc(100svh-var(--header-height))]!">
            <SidebarContent>
              <SidebarMenu label="Main">
                <SidebarMenuItem icon={<span>🏠</span>} title="Dashboard" href="#" />
                <SidebarMenuItem icon={<span>📁</span>} title="Projects">
                  <SidebarSubItem title="Project Alpha" href="#" />
                  <SidebarSubItem title="Project Beta" href="#" />
                  <SidebarSubItem title="Project Gamma" href="#" isActive />
                </SidebarMenuItem>
                <SidebarMenuItem icon={<span>⚙️</span>} title="Settings" href="#" />
              </SidebarMenu>
              <SidebarMenu label="Team">
                <SidebarMenuItem icon={<span>👥</span>} title="Members">
                  <SidebarSubItem title="Alice" href="#" />
                  <SidebarSubItem title="Bob" href="#" />
                  <SidebarSubItem title="Charlie" href="#" />
                </SidebarMenuItem>
                <SidebarMenuItem icon={<span>➕</span>} title="Invite" href="#" />
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
          <SidebarInset className="flex flex-col">
            <div className="p-4">Main Content Area</div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A navbar with sidebar integration. Shows how to combine the navbar with a sidebar component for a complete navigation experience.',
      },
    },
  },
};
