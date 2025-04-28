import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Container } from '@/components/ui/container';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import type { Meta, StoryObj } from '@storybook/react';
import { BookOpen, Bot, Command, Frame, LifeBuoy, Map, PieChart, Send, Settings2, SquareTerminal } from 'lucide-react';
import * as React from 'react';
import { Toolbar, ToolbarButton } from '../../../src/components/ui/toolbar';

const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    {
      title: 'Playground',
      url: '#',
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: 'History',
          url: '#',
        },
        {
          title: 'Starred',
          url: '#',
        },
        {
          title: 'Settings',
          url: '#',
        },
      ],
    },
    {
      title: 'Models',
      url: '#',
      icon: Bot,
      items: [
        {
          title: 'Genesis',
          url: '#',
        },
        {
          title: 'Explorer',
          url: '#',
        },
        {
          title: 'Quantum',
          url: '#',
        },
      ],
    },
    {
      title: 'Documentation',
      url: '#',
      icon: BookOpen,
      items: [
        {
          title: 'Introduction',
          url: '#',
        },
        {
          title: 'Get Started',
          url: '#',
        },
        {
          title: 'Tutorials',
          url: '#',
        },
        {
          title: 'Changelog',
          url: '#',
        },
      ],
    },
    {
      title: 'Settings',
      url: '#',
      icon: Settings2,
      items: [
        {
          title: 'General',
          url: '#',
        },
        {
          title: 'Team',
          url: '#',
        },
        {
          title: 'Billing',
          url: '#',
        },
        {
          title: 'Limits',
          url: '#',
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: 'Support',
      url: '#',
      icon: LifeBuoy,
    },
    {
      title: 'Feedback',
      url: '#',
      icon: Send,
    },
  ],
  projects: [
    {
      name: 'Design Engineering',
      url: '#',
      icon: Frame,
    },
    {
      name: 'Sales & Marketing',
      url: '#',
      icon: PieChart,
    },
    {
      name: 'Travel',
      url: '#',
      icon: Map,
    },
  ],
};

const meta = {
  title: 'Layout Examples/Inset Sidebar',
  component: SidebarProvider,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
### Inset Sidebar Layout Example

A modern application layout featuring an inset sidebar design pattern. This layout is ideal for applications that require hierarchical navigation while maintaining a clean and organized interface.

#### Features

- **Inset Sidebar Design**: A sidebar that sits within the main content area rather than along the edge of the viewport
- **Hierarchical Navigation**: Multi-level navigation structure with collapsible sections
- **Project Switching**: Quick access to different projects with visual indicators
- **User Profile Integration**: User information and avatar displayed in the footer
- **Responsive Design**: Adapts to different screen sizes while maintaining functionality
- **Platform Navigation**: Organized sections for different platform features
- **Support Links**: Easy access to support and feedback options

#### Best Practices

1. **Navigation Structure**
   - Group related items under clear categories
   - Use icons consistently to improve visual recognition
   - Limit nesting to 2 levels for better usability

2. **Visual Hierarchy**
   - Use clear visual separation between sections
   - Highlight active items for clear context
   - Maintain consistent spacing and alignment

3. **Responsive Behavior**
   - Provide collapsible options for smaller screens
   - Ensure touch targets are appropriately sized
   - Maintain functionality across all device sizes

4. **Accessibility**
   - Include proper ARIA labels and roles
   - Ensure keyboard navigation works correctly
   - Provide clear visual feedback for interactive elements

#### Usage Guidelines

1. **When to Use**
   - Complex applications requiring hierarchical navigation
   - Platforms with multiple user workspaces
   - Systems needing clear separation of navigation levels

2. **Implementation Considerations**
   - Consider the depth of your navigation structure
   - Plan for future navigation items and scaling
   - Ensure consistent behavior across different sections

3. **Customization**
   - Adapt colors and styling to match your brand
   - Modify spacing and sizing for different needs
   - Add or remove sections based on requirements`,
      },
    },
  },
} satisfies Meta<typeof SidebarProvider>;

export default meta;
type Story = StoryObj<typeof SidebarProvider>;

export const Default: Story = {
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        story: `
A complete implementation of the inset sidebar layout showcasing:
- Multi-level navigation with collapsible items
- Project quick-access section
- Support and feedback links
- User profile integration
- Responsive design considerations`,
      },
    },
  },
  render: () => {
    const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
      return (
        <Sidebar variant="inset" {...props}>
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem icon={<Command className="h-4 w-4" />} title="Acme Inc" href="#" />
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu label="Platform">
              {data.navMain.map((item) => (
                <SidebarMenuItem
                  key={item.title}
                  icon={<item.icon className="h-4 w-4" />}
                  title={item.title}
                  href={item.url}
                  isActive={item.isActive}
                  defaultOpen={item.isActive}
                  tooltip={item.title}
                >
                  {item.items?.map((subItem) => (
                    <SidebarMenuItem key={subItem.title} title={subItem.title} href={subItem.url} />
                  ))}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <SidebarMenu label="Projects">
              {data.projects.map((project) => (
                <SidebarMenuItem
                  key={project.name}
                  icon={<project.icon className="h-4 w-4" />}
                  title={project.name}
                  href={project.url}
                  tooltip={project.name}
                />
              ))}
            </SidebarMenu>
            <SidebarMenu label="Support">
              {data.navSecondary.map((item) => (
                <SidebarMenuItem
                  key={item.title}
                  icon={<item.icon className="h-4 w-4" />}
                  title={item.title}
                  href={item.url}
                  tooltip={item.title}
                />
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem
                icon={
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={data.user.avatar} alt={data.user.name} />
                    <AvatarFallback>{data.user.name[0]}</AvatarFallback>
                  </Avatar>
                }
                title={data.user.name}
                tooltip={data.user.name}
              />
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      );
    };

    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Building Your Application</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="grid auto-rows-min gap-4 md:grid-cols-3">
              <div className="aspect-video rounded-xl bg-muted/50" />
              <div className="aspect-video rounded-xl bg-muted/50" />
              <div className="aspect-video rounded-xl bg-muted/50" />
            </div>
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  },
};

export const Floating: Story = {
  render: () => {
    const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
      return (
        <Sidebar variant="floating" collapsible="icon" hoverExpand {...props}>
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem icon={<Command className="h-4 w-4" />} title="Acme Inc" href="#" />
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu label="Platform">
              {data.navMain.map((item) => (
                <SidebarMenuItem
                  key={item.title}
                  icon={<item.icon className="h-4 w-4" />}
                  title={item.title}
                  href={item.url}
                  isActive={item.isActive}
                  defaultOpen={item.isActive}
                  tooltip={item.title}
                >
                  {item.items?.map((subItem) => (
                    <SidebarMenuItem key={subItem.title} title={subItem.title} href={subItem.url} />
                  ))}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <SidebarMenu label="Projects">
              {data.projects.map((project) => (
                <SidebarMenuItem
                  key={project.name}
                  icon={<project.icon className="h-4 w-4" />}
                  title={project.name}
                  href={project.url}
                  tooltip={project.name}
                />
              ))}
            </SidebarMenu>
            <SidebarMenu label="Support">
              {data.navSecondary.map((item) => (
                <SidebarMenuItem
                  key={item.title}
                  icon={<item.icon className="h-4 w-4" />}
                  title={item.title}
                  href={item.url}
                  tooltip={item.title}
                />
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem
                icon={
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={data.user.avatar} alt={data.user.name} />
                    <AvatarFallback>{data.user.name[0]}</AvatarFallback>
                  </Avatar>
                }
                title={data.user.name}
                tooltip={data.user.name}
              />
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      );
    };

    return (
      <SidebarProvider>
        <div className="flex min-h-screen bg-muted/20">
          <AppSidebar />
          <main className="flex-1 p-8">
            <div className="mx-auto max-w-5xl">
              <h1 className="text-3xl font-bold">Floating Sidebar</h1>
              <p className="mt-2 text-muted-foreground">
                This example demonstrates a floating sidebar with hover expand functionality. Try hovering over the
                collapsed sidebar to see it expand.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-medium">Features</h2>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                    <li>Floating variant with rounded corners</li>
                    <li>Collapsible to icon-only mode</li>
                    <li>Hover to expand functionality</li>
                    <li>Tooltips in collapsed state</li>
                    <li>Responsive design</li>
                  </ul>
                </div>
                <div className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-medium">Usage</h2>
                  <pre className="mt-2 rounded bg-muted p-2 text-sm">
                    {`<Sidebar
  variant="floating"
  collapsible="icon"
  hoverExpand
>
  <SidebarHeader>...</SidebarHeader>
  <SidebarContent>...</SidebarContent>
  <SidebarFooter>...</SidebarFooter>
</Sidebar>`}
                  </pre>
                </div>
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  },
};

export const WithToolbar: Story = {
  parameters: {
    docs: {
      description: {
        story: `
A floating sidebar layout with a toolbar containing a sidebar trigger button. The toolbar provides quick access to common actions while the sidebar remains collapsible.`,
      },
    },
  },
  render: () => {
    const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
      return (
        <Sidebar variant="floating" collapsible="offcanvas" hoverExpand {...props}>
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem icon={<Command className="h-4 w-4" />} title="Acme Inc" href="#" />
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu label="Platform">
              {data.navMain.map((item) => (
                <SidebarMenuItem
                  key={item.title}
                  icon={<item.icon className="h-4 w-4" />}
                  title={item.title}
                  href={item.url}
                  isActive={item.isActive}
                  defaultOpen={item.isActive}
                  tooltip={item.title}
                >
                  {item.items?.map((subItem) => (
                    <SidebarMenuItem key={subItem.title} title={subItem.title} href={subItem.url} />
                  ))}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <SidebarMenu label="Projects">
              {data.projects.map((project) => (
                <SidebarMenuItem
                  key={project.name}
                  icon={<project.icon className="h-4 w-4" />}
                  title={project.name}
                  href={project.url}
                  tooltip={project.name}
                />
              ))}
            </SidebarMenu>
            <SidebarMenu label="Support">
              {data.navSecondary.map((item) => (
                <SidebarMenuItem
                  key={item.title}
                  icon={<item.icon className="h-4 w-4" />}
                  title={item.title}
                  href={item.url}
                  tooltip={item.title}
                />
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem
                icon={
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={data.user.avatar} alt={data.user.name} />
                    <AvatarFallback>{data.user.name[0]}</AvatarFallback>
                  </Avatar>
                }
                title={data.user.name}
                tooltip={data.user.name}
              />
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      );
    };

    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 p-8">
          <Container>
            <h1 className="text-3xl font-bold">Floating Sidebar with Toolbar</h1>
            <p className="mt-2 text-muted-foreground">
              This example demonstrates a floating sidebar with a toolbar containing quick actions. The toolbar includes
              a sidebar trigger and common actions.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-medium">Features</h2>
                <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                  <li>Floating toolbar with sidebar integration</li>
                  <li>Quick access to common actions</li>
                  <li>Responsive design</li>
                  <li>Collapsible sidebar with hover expand</li>
                </ul>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-medium">Usage</h2>
                <pre className="mt-2 rounded bg-muted p-2 text-sm">
                  {`<Toolbar position="bottom-center">
  <ToolbarButton
    icon={<SidebarTrigger />}
    aria-label="Toggle sidebar"
  />
  {/* Additional toolbar items */}
</Toolbar>`}
                </pre>
              </div>
            </div>
          </Container>
        </main>

        <Toolbar position="top-left" showWhenSidebarClosed size="sm">
          <ToolbarButton icon={<SidebarTrigger />} aria-label="Toggle sidebar" />
        </Toolbar>
      </SidebarProvider>
    );
  },
};
