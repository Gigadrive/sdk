import {
  ArchiveX,
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  Command,
  CreditCard,
  File,
  Inbox,
  LogOut,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import type { Meta, StoryObj } from '@storybook/react';

const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    {
      title: 'Inbox',
      url: '#',
      icon: Inbox,
      isActive: true,
    },
    {
      title: 'Drafts',
      url: '#',
      icon: File,
      isActive: false,
    },
    {
      title: 'Sent',
      url: '#',
      icon: Send,
      isActive: false,
    },
    {
      title: 'Junk',
      url: '#',
      icon: ArchiveX,
      isActive: false,
    },
    {
      title: 'Trash',
      url: '#',
      icon: Trash2,
      isActive: false,
    },
  ],
  mails: [
    {
      name: 'William Smith',
      email: 'williamsmith@example.com',
      subject: 'Meeting Tomorrow',
      date: '09:34 AM',
      teaser:
        'Hi team, just a reminder about our meeting tomorrow at 10 AM.\nPlease come prepared with your project updates.',
    },
    {
      name: 'Alice Smith',
      email: 'alicesmith@example.com',
      subject: 'Re: Project Update',
      date: 'Yesterday',
      teaser:
        "Thanks for the update. The progress looks great so far.\nLet's schedule a call to discuss the next steps.",
    },
  ],
};

function NavUser({ user }: { user: typeof data.user }) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground md:h-8 md:p-0">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [activeItem, setActiveItem] = React.useState(data.navMain[0]);
  const [mails] = React.useState(data.mails);
  const { setOpen } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row" {...props}>
      <Sidebar collapsible="none" className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem
              href="#"
              icon={
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Command className="size-4" />
                </div>
              }
              title={
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Acme Inc</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              }
            />
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {data.navMain.map((item) => (
              <SidebarMenuItem
                key={item.title}
                icon={<item.icon />}
                title={item.title}
                tooltip={item.title}
                isActive={activeItem.title === item.title}
                onClick={() => {
                  setActiveItem(item);
                  setOpen(true);
                }}
                className="px-2.5 md:px-2"
              />
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={data.user} />
        </SidebarFooter>
      </Sidebar>

      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium text-foreground">{activeItem.title}</div>
            <Label className="flex items-center gap-2 text-sm">
              <span>Unreads</span>
              <Switch className="shadow-none" />
            </Label>
          </div>
          <SidebarInput placeholder="Type to search..." />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {mails.map((mail) => (
              <a
                href="#"
                key={mail.email}
                className="flex flex-col items-start gap-2 whitespace-nowrap border-b p-4 text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <div className="flex w-full items-center gap-2">
                  <span>{mail.name}</span> <span className="ml-auto text-xs">{mail.date}</span>
                </div>
                <span className="font-medium">{mail.subject}</span>
                <span className="line-clamp-2 w-[260px] whitespace-break-spaces text-xs">{mail.teaser}</span>
              </a>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  );
}

function CollapsibleNestedSidebars() {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '350px',
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">All Inboxes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Inbox</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {Array.from({ length: 24 }).map((_, index) => (
            <div key={index} className="aspect-video h-12 w-full rounded-lg bg-muted/50" />
          ))}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

const meta = {
  title: 'Layout Examples/Collapsible Nested Sidebars',
  component: SidebarProvider,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
### Collapsible Nested Sidebars Layout Example

An advanced layout pattern featuring multiple collapsible sidebars, perfect for complex applications requiring hierarchical navigation and content organization.

#### Features

- **Nested Sidebars**: Multiple levels of navigation with independent collapsibility
- **Icon-Only Mode**: Collapsible primary sidebar with icon-only state
- **Mail-like Interface**: Familiar email client-style layout
- **User Profile Integration**: Dropdown menu with user settings and actions
- **Search Functionality**: Integrated search within navigation
- **Dynamic Content**: Interactive content area with real-time updates
- **Responsive Design**: Adapts to different screen sizes with appropriate behavior

#### Best Practices

1. **Navigation Structure**
   - Organize content hierarchically
   - Use clear visual indicators for active states
   - Provide consistent interaction patterns
   - Implement smooth transitions between states

2. **Sidebar Management**
   - Allow independent control of each sidebar
   - Maintain context when collapsing/expanding
   - Provide clear visual separation between sidebars
   - Implement proper overflow handling

3. **User Experience**
   - Enable quick navigation between sections
   - Maintain visual consistency across states
   - Provide clear feedback for user actions
   - Implement intuitive collapse/expand behavior

4. **Responsive Behavior**
   - Adapt layout for different screen sizes
   - Handle mobile navigation appropriately
   - Maintain functionality in collapsed states
   - Provide touch-friendly interactions

#### Usage Guidelines

1. **When to Use**
   - Complex applications with multiple navigation levels
   - Email or document management systems
   - Platforms requiring quick context switching
   - Applications with hierarchical data structures

2. **Implementation Considerations**
   - Plan navigation hierarchy carefully
   - Consider state management needs
   - Account for deep linking and routing
   - Plan for content organization

3. **Customization Options**
   - Adjust collapse behavior and animations
   - Modify sidebar widths and transitions
   - Customize visual indicators and states
   - Adapt layout for specific needs

#### Accessibility

- Implement proper keyboard navigation
- Maintain focus management across sidebars
- Provide clear ARIA labels and roles
- Ensure proper screen reader support
- Include appropriate keyboard shortcuts

#### Performance

- Optimize transition animations
- Implement efficient state management
- Handle content loading appropriately
- Consider lazy loading for nested content`,
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
A complete implementation of the collapsible nested sidebars layout featuring:
- Primary sidebar with icon-only collapse mode
- Secondary sidebar with mail navigation
- User profile dropdown with actions
- Search functionality
- Dynamic content area
- Responsive behavior and animations`,
      },
    },
  },
  render: () => <CollapsibleNestedSidebars />,
};
