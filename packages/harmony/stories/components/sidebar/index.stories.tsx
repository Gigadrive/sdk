import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Bell,
  Bookmark,
  CreditCard,
  FileText,
  Globe,
  Heart,
  Home,
  Key,
  Lock,
  Mail,
  MessageSquare,
  Monitor,
  Paintbrush,
  Search,
  Settings,
  Share2,
  Shield,
  Smartphone,
  User,
  Users,
  Zap,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Navbar, NavbarActions } from '@/components/ui/navbar';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarItem,
  SidebarProvider,
  SidebarSkeleton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

const meta = {
  title: 'Components/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    collapsible: {
      control: 'select',
      options: ['offcanvas', 'icon', 'none'],
    },
    side: {
      control: 'select',
      options: ['left', 'right'],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Default ─────────────────────────────────────────────────────────────────

function DefaultDemo() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
                <Zap className="h-4 w-4 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Acme Inc</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarItem icon={Home} title="Dashboard" href="#" isActive />
              <SidebarItem icon={Users} title="Team" href="#" badge="3" />
              <SidebarItem icon={Mail} title="Messages" href="#" badge="12" />
              <SidebarItem icon={FileText} title="Documents" href="#" />
            </SidebarGroup>
            <SidebarGroup label="Settings">
              <SidebarItem icon={Settings} title="General" href="#" />
              <SidebarItem icon={Bell} title="Notifications" href="#" />
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[0.625rem]">JD</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">Jane Doe</span>
                <span className="text-[0.6875rem] text-muted-foreground">jane@acme.com</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 p-8 bg-background">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1.5 text-muted-foreground">Welcome back, Jane.</p>
        </main>
      </div>
    </SidebarProvider>
  );
}

export const Default: Story = {
  render: () => <DefaultDemo />,
};

// ─── WithLayers ──────────────────────────────────────────────────────────────

function WithLayersDemo() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
                <Zap className="h-4 w-4 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Acme Inc</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarItem icon={Home} title="Dashboard" href="#" isActive />
              <SidebarItem icon={Users} title="Team" href="#" />
              <SidebarItem icon={Mail} title="Messages" href="#" badge="5" />
            </SidebarGroup>
            <SidebarGroup label="Settings">
              <SidebarItem icon={User} title="Account">
                <SidebarGroup>
                  <SidebarItem icon={User} title="Profile" href="#" />
                  <SidebarItem icon={Mail} title="Email" href="#" />
                  <SidebarItem icon={Globe} title="Language" href="#" />
                  <SidebarItem icon={Paintbrush} title="Appearance">
                    <SidebarGroup>
                      <SidebarItem icon={Monitor} title="Theme" href="#" />
                      <SidebarItem icon={Paintbrush} title="Colors" href="#" />
                    </SidebarGroup>
                  </SidebarItem>
                </SidebarGroup>
              </SidebarItem>
              <SidebarItem icon={Shield} title="Security">
                <SidebarGroup>
                  <SidebarItem icon={Lock} title="Password" href="#" />
                  <SidebarItem icon={Smartphone} title="Two-Factor Auth" href="#" />
                  <SidebarItem icon={Key} title="API Keys" href="#" />
                </SidebarGroup>
              </SidebarItem>
              <SidebarItem icon={CreditCard} title="Billing">
                <SidebarGroup>
                  <SidebarItem icon={CreditCard} title="Payment Methods" href="#" />
                  <SidebarItem icon={FileText} title="Invoices" href="#" />
                </SidebarGroup>
              </SidebarItem>
              <SidebarItem icon={Bell} title="Notifications" href="#" />
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[0.625rem]">JD</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">Jane Doe</span>
                <span className="text-[0.6875rem] text-muted-foreground">jane@acme.com</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 p-8 bg-background">
          <h1 className="text-2xl font-bold tracking-tight">Layer Navigation</h1>
          <p className="mt-1.5 text-muted-foreground">
            Click &ldquo;Account&rdquo;, &ldquo;Security&rdquo;, or &ldquo;Billing&rdquo; to navigate into sub-layers.
            &ldquo;Appearance&rdquo; inside Account goes three levels deep.
          </p>
        </main>
      </div>
    </SidebarProvider>
  );
}

export const WithLayers: Story = {
  render: () => <WithLayersDemo />,
};

// ─── CollapsibleIcon ─────────────────────────────────────────────────────────

function CollapsibleIconContent() {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex h-screen w-full">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground">
              <Zap className="h-4 w-4 text-background" />
            </div>
            <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">Acme</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarItem icon={Home} title="Dashboard" href="#" isActive tooltip="Dashboard" />
            <SidebarItem icon={Users} title="Team" href="#" tooltip="Team" />
            <SidebarItem icon={Mail} title="Messages" href="#" tooltip="Messages" badge="5" />
            <SidebarItem icon={FileText} title="Documents" href="#" tooltip="Documents" />
          </SidebarGroup>
          <SidebarGroup label="Settings">
            <SidebarItem icon={Settings} title="Settings" tooltip="Settings">
              <SidebarGroup>
                <SidebarItem icon={User} title="Account" href="#" />
                <SidebarItem icon={Shield} title="Security">
                  <SidebarGroup>
                    <SidebarItem icon={Lock} title="Password" href="#" />
                    <SidebarItem icon={Key} title="API Keys" href="#" />
                  </SidebarGroup>
                </SidebarItem>
                <SidebarItem icon={Bell} title="Notifications" href="#" />
              </SidebarGroup>
            </SidebarItem>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <main className="flex-1 p-8 bg-background">
        <Button onClick={toggleSidebar} variant="outline" size="sm" className="mb-6">
          Toggle Sidebar
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Icon Collapse</h1>
        <p className="mt-1.5 text-muted-foreground">
          Collapse the sidebar to icon-only mode. Tooltips appear on hover.
        </p>
      </main>
    </div>
  );
}

function CollapsibleIconDemo() {
  return (
    <SidebarProvider>
      <CollapsibleIconContent />
    </SidebarProvider>
  );
}

export const CollapsibleIcon: Story = {
  render: () => <CollapsibleIconDemo />,
};

// ─── WithBadges ──────────────────────────────────────────────────────────────

function WithBadgesDemo() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
                <Zap className="h-4 w-4 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Acme Inc</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarItem icon={Home} title="Dashboard" href="#" isActive />
              <SidebarItem icon={Mail} title="Inbox" href="#" badge="24" />
              <SidebarItem icon={Users} title="Team" href="#" badge="3" />
              <SidebarItem
                icon={Bell}
                title="Notifications"
                href="#"
                badge={<span className="h-2 w-2 rounded-full bg-red-500" />}
              />
              <SidebarItem icon={FileText} title="Documents" href="#" badge="128" />
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 p-8 bg-background">
          <h1 className="text-2xl font-bold tracking-tight">Badges</h1>
          <p className="mt-1.5 text-muted-foreground">
            Items can display text badges, counts, or custom badge content like status dots.
          </p>
        </main>
      </div>
    </SidebarProvider>
  );
}

export const WithBadges: Story = {
  render: () => <WithBadgesDemo />,
};

// ─── RightSide ───────────────────────────────────────────────────────────────

function RightSideDemo() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <main className="flex-1 p-8 bg-background">
          <h1 className="text-2xl font-bold tracking-tight">Right-Side Sidebar</h1>
          <p className="mt-1.5 text-muted-foreground">
            The sidebar is positioned on the right. Layer animations adjust direction accordingly.
          </p>
        </main>
        <Sidebar side="right">
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <span className="text-sm font-semibold tracking-tight">Inspector</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup label="Properties">
              <SidebarItem icon={Paintbrush} title="Style" href="#" isActive />
              <SidebarItem icon={Settings} title="Layout" href="#" />
              <SidebarItem icon={Globe} title="SEO" href="#" />
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </div>
    </SidebarProvider>
  );
}

export const RightSide: Story = {
  render: () => <RightSideDemo />,
};

// ─── Loading ─────────────────────────────────────────────────────────────────

function LoadingDemo() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <div className="h-7 w-7 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarSkeleton showIcon />
              <SidebarSkeleton showIcon />
              <SidebarSkeleton showIcon />
              <SidebarSkeleton showIcon />
            </SidebarGroup>
            <SidebarGroup label="More">
              <SidebarSkeleton showIcon />
              <SidebarSkeleton showIcon />
              <SidebarSkeleton />
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
              <div className="flex flex-col gap-1">
                <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 p-8 bg-background">
          <h1 className="text-2xl font-bold tracking-tight">Loading State</h1>
          <p className="mt-1.5 text-muted-foreground">SidebarSkeleton provides realistic loading placeholders.</p>
        </main>
      </div>
    </SidebarProvider>
  );
}

export const Loading: Story = {
  render: () => <LoadingDemo />,
};

// ─── DeepNesting ─────────────────────────────────────────────────────────────

function DeepNestingDemo() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
                <Zap className="h-4 w-4 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Deep Nav</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarItem icon={Home} title="Home" href="#" isActive />
              <SidebarItem icon={Settings} title="Settings">
                <SidebarGroup>
                  <SidebarItem icon={User} title="Profile">
                    <SidebarGroup>
                      <SidebarItem icon={Paintbrush} title="Appearance">
                        <SidebarGroup>
                          <SidebarItem icon={Monitor} title="Theme" href="#" />
                          <SidebarItem icon={Paintbrush} title="Colors" href="#" />
                          <SidebarItem icon={Globe} title="Language" href="#" />
                        </SidebarGroup>
                      </SidebarItem>
                      <SidebarItem icon={Mail} title="Contact Info" href="#" />
                      <SidebarItem icon={Globe} title="Social Links" href="#" />
                    </SidebarGroup>
                  </SidebarItem>
                  <SidebarItem icon={Shield} title="Privacy" href="#" />
                  <SidebarItem icon={Bell} title="Notifications" href="#" />
                </SidebarGroup>
              </SidebarItem>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 p-8 bg-background">
          <h1 className="text-2xl font-bold tracking-tight">Deep Nesting</h1>
          <p className="mt-1.5 text-muted-foreground">
            Navigate Settings &rarr; Profile &rarr; Appearance to reach four levels deep. Each layer slides in with a
            spring animation. Use the back button to return.
          </p>
        </main>
      </div>
    </SidebarProvider>
  );
}

export const DeepNesting: Story = {
  render: () => <DeepNestingDemo />,
};

// ─── WithTrigger ─────────────────────────────────────────────────────────────

function WithTriggerContent() {
  return (
    <div className="flex h-screen w-full">
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
                <Zap className="h-4 w-4 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Acme</span>
            </div>
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarItem icon={Home} title="Dashboard" href="#" isActive />
            <SidebarItem icon={Users} title="Team" href="#" />
            <SidebarItem icon={Settings} title="Settings" href="#" />
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <main className="flex-1 p-8 bg-background">
        <h1 className="text-2xl font-bold tracking-tight">With Trigger</h1>
        <p className="mt-1.5 text-muted-foreground">
          The sidebar trigger button is placed in the header. You can also toggle with Ctrl+B / Cmd+B.
        </p>
      </main>
    </div>
  );
}

function WithTriggerDemo() {
  return (
    <SidebarProvider>
      <WithTriggerContent />
    </SidebarProvider>
  );
}

export const WithTrigger: Story = {
  render: () => <WithTriggerDemo />,
};

// ─── DualSidebar ─────────────────────────────────────────────────────────────

function DualSidebarDemo() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
                <Zap className="h-4 w-4 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Workspace</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarItem icon={Home} title="Dashboard" href="#" isActive />
              <SidebarItem icon={Users} title="Team" href="#" badge="4" />
              <SidebarItem icon={Mail} title="Messages" href="#" badge="12" />
              <SidebarItem icon={FileText} title="Documents" href="#" />
            </SidebarGroup>
            <SidebarGroup label="Settings">
              <SidebarItem icon={Settings} title="Settings">
                <SidebarGroup>
                  <SidebarItem icon={User} title="Account" href="#" />
                  <SidebarItem icon={Shield} title="Security" href="#" />
                  <SidebarItem icon={Bell} title="Notifications" href="#" />
                </SidebarGroup>
              </SidebarItem>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[0.625rem]">JD</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">Jane Doe</span>
                <span className="text-[0.6875rem] text-muted-foreground">jane@acme.com</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 p-8 bg-background">
          <h1 className="text-2xl font-bold tracking-tight">Dual Sidebar</h1>
          <p className="mt-1.5 text-muted-foreground">
            Full navigation sidebar on the left, icon-only toolbar sidebar on the right.
          </p>
        </main>
        <Sidebar
          side="right"
          collapsible="none"
          className="w-[var(--sidebar-width-icon)] border-l border-sidebar-border"
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarItem icon={Search} title="Search" href="#" tooltip="Search" />
              <SidebarItem icon={Bookmark} title="Bookmarks" href="#" tooltip="Bookmarks" />
              <SidebarItem icon={Heart} title="Favorites" href="#" tooltip="Favorites" />
              <SidebarItem icon={MessageSquare} title="Comments" href="#" tooltip="Comments" />
              <SidebarItem icon={Share2} title="Share" href="#" tooltip="Share" />
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </div>
    </SidebarProvider>
  );
}

export const DualSidebar: Story = {
  render: () => <DualSidebarDemo />,
};

// ─── AppLayout ───────────────────────────────────────────────────────────────

function AppLayoutDemo() {
  return (
    <SidebarProvider hasNavbar className="h-screen">
      <Navbar
        size="sm"
        showSidebar
        logo={
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground">
              <Zap className="h-3.5 w-3.5 text-background" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Acme Inc</span>
          </div>
        }
      >
        <NavbarActions>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Bell className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[0.625rem]">JD</AvatarFallback>
          </Avatar>
        </NavbarActions>
      </Navbar>

      <div className="flex flex-1 min-h-0">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarItem icon={Home} title="Dashboard" href="#" isActive />
              <SidebarItem icon={Users} title="Team" href="#" badge="4" />
              <SidebarItem icon={Mail} title="Messages" href="#" badge="12" />
              <SidebarItem icon={FileText} title="Documents" href="#" />
            </SidebarGroup>
            <SidebarGroup label="Settings">
              <SidebarItem icon={Settings} title="Settings">
                <SidebarGroup>
                  <SidebarItem icon={User} title="Account" href="#" />
                  <SidebarItem icon={Shield} title="Security" href="#" />
                  <SidebarItem icon={Bell} title="Notifications" href="#" />
                </SidebarGroup>
              </SidebarItem>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[0.625rem]">JD</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">Jane Doe</span>
                <span className="text-[0.6875rem] text-muted-foreground">jane@acme.com</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 p-6 overflow-y-auto bg-background">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1.5 text-muted-foreground">Welcome back, Jane.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <p className="mt-1 text-2xl font-bold">2,847</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">Revenue</p>
              <p className="mt-1 text-2xl font-bold">$48,290</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">Active Now</p>
              <p className="mt-1 text-2xl font-bold">342</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border bg-card p-5 min-h-[300px]">
            <p className="text-sm font-medium text-muted-foreground">Activity</p>
          </div>
        </main>

        <Sidebar
          side="right"
          collapsible="none"
          className="w-[var(--sidebar-width-icon)] border-l border-sidebar-border"
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarItem icon={Search} title="Search" href="#" tooltip="Search" />
              <SidebarItem icon={Bookmark} title="Bookmarks" href="#" tooltip="Bookmarks" />
              <SidebarItem icon={Heart} title="Favorites" href="#" tooltip="Favorites" />
              <SidebarItem icon={MessageSquare} title="Comments" href="#" tooltip="Comments" />
              <SidebarItem icon={Share2} title="Share" href="#" tooltip="Share" />
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </div>
    </SidebarProvider>
  );
}

export const AppLayout: Story = {
  render: () => <AppLayoutDemo />,
};

// ─── InsetLayout ─────────────────────────────────────────────────────────────

function InsetLayoutDemo() {
  return (
    <SidebarProvider hasNavbar variant="inset" className="h-screen">
      <Navbar
        size="sm"
        showSidebar
        logo={
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground">
              <Zap className="h-3.5 w-3.5 text-background" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Acme Inc</span>
          </div>
        }
      >
        <NavbarActions>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Bell className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[0.625rem]">JD</AvatarFallback>
          </Avatar>
        </NavbarActions>
      </Navbar>

      <div className="flex flex-1 min-h-0">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarItem icon={Home} title="Dashboard" href="#" isActive />
              <SidebarItem icon={Users} title="Team" href="#" badge="4" />
              <SidebarItem icon={Mail} title="Messages" href="#" badge="12" />
              <SidebarItem icon={FileText} title="Documents" href="#" />
            </SidebarGroup>
            <SidebarGroup label="Settings">
              <SidebarItem icon={Settings} title="Settings">
                <SidebarGroup>
                  <SidebarItem icon={User} title="Account" href="#" />
                  <SidebarItem icon={Shield} title="Security" href="#" />
                  <SidebarItem icon={Bell} title="Notifications" href="#" />
                </SidebarGroup>
              </SidebarItem>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-2.5 px-2 py-1">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[0.625rem]">JD</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">Jane Doe</span>
                <span className="text-[0.6875rem] text-muted-foreground">jane@acme.com</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="p-6">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1.5 text-muted-foreground">Welcome back, Jane.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <p className="mt-1 text-2xl font-bold">2,847</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">Revenue</p>
              <p className="mt-1 text-2xl font-bold">$48,290</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">Active Now</p>
              <p className="mt-1 text-2xl font-bold">342</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border bg-card p-5 min-h-[300px]">
            <p className="text-sm font-medium text-muted-foreground">Activity</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 min-h-[200px]">
              <p className="text-sm font-medium text-muted-foreground">Recent Orders</p>
              <div className="mt-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium">Order #{4200 + i}</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                    <p className="text-sm font-medium">${(Math.random() * 500 + 50).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 min-h-[200px]">
              <p className="text-sm font-medium text-muted-foreground">Top Products</p>
              <div className="mt-4 space-y-3">
                {['Widget Pro', 'Gadget X', 'Tool Suite', 'Plugin Pack', 'API Access', 'Enterprise'].map((name, i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{Math.floor(Math.random() * 500 + 100)} sales</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border bg-card p-5 min-h-[250px]">
            <p className="text-sm font-medium text-muted-foreground">Team Activity</p>
            <div className="mt-4 space-y-4">
              {[
                'Jane pushed 3 commits to main',
                'Alex opened PR #142: Fix auth flow',
                'Sam deployed v2.4.1 to production',
                'Chris commented on issue #89',
                'Jane merged PR #140: Add dark mode',
                'Alex closed issue #85: Timeout error',
                'Sam updated dependencies',
                'Chris created branch feature/notifications',
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                  <div>
                    <p className="text-sm">{activity}</p>
                    <p className="text-xs text-muted-foreground">{i + 1}h ago</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SidebarInset>

        <Sidebar side="right" collapsible="none" className="w-[var(--sidebar-width-icon)]">
          <SidebarContent>
            <SidebarGroup>
              <SidebarItem icon={Search} title="Search" href="#" tooltip="Search" />
              <SidebarItem icon={Bookmark} title="Bookmarks" href="#" tooltip="Bookmarks" />
              <SidebarItem icon={Heart} title="Favorites" href="#" tooltip="Favorites" />
              <SidebarItem icon={MessageSquare} title="Comments" href="#" tooltip="Comments" />
              <SidebarItem icon={Share2} title="Share" href="#" tooltip="Share" />
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </div>
    </SidebarProvider>
  );
}

export const InsetLayout: Story = {
  render: () => <InsetLayoutDemo />,
};
