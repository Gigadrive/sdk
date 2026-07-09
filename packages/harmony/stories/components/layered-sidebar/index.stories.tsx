import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Bell,
  Bot,
  CreditCard,
  FileText,
  GitBranch,
  Globe,
  Home,
  Key,
  Lock,
  Settings,
  Shield,
  Variable,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  LayeredSidebarContent,
  LayeredSidebarProvider,
  type LayeredSidebarLayer,
} from '@/components/ui/layered-sidebar';
import { Sidebar, SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar';

const meta = {
  title: 'Components/LayeredSidebar',
  component: LayeredSidebarContent,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LayeredSidebarContent>;

export default meta;
type Story = StoryObj<typeof meta>;

function icon(Icon: React.ComponentType<{ className?: string }>) {
  return <Icon className="size-4" />;
}

function buildSettingsLayer(pathname: string): LayeredSidebarLayer {
  return {
    id: 'settings',
    title: 'Settings',
    icon: icon(Settings),
    sections: [
      {
        id: 'settings-main',
        title: '',
        items: [
          {
            id: 'general',
            title: 'General',
            icon: icon(Settings),
            href: '/app/settings',
            isActive: pathname === '/app/settings',
          },
          {
            id: 'domains',
            title: 'Domains',
            icon: icon(Globe),
            href: '/app/settings/domains',
            isActive: pathname.startsWith('/app/settings/domains'),
          },
          {
            id: 'variables',
            title: 'Variables',
            icon: icon(Variable),
            href: '/app/settings/variables',
            isActive: pathname.startsWith('/app/settings/variables'),
          },
          {
            id: 'git',
            title: 'Git',
            icon: icon(GitBranch),
            href: '/app/settings/git',
            isActive: pathname.startsWith('/app/settings/git'),
          },
        ],
      },
    ],
  };
}

function buildSecurityLayer(pathname: string): LayeredSidebarLayer {
  return {
    id: 'security',
    title: 'Security',
    icon: icon(Shield),
    sections: [
      {
        id: 'security-main',
        title: '',
        items: [
          {
            id: 'password',
            title: 'Password',
            icon: icon(Lock),
            href: '/app/security/password',
            isActive: pathname.startsWith('/app/security/password'),
          },
          {
            id: 'api-keys',
            title: 'API Keys',
            icon: icon(Key),
            href: '/app/security/api-keys',
            isActive: pathname.startsWith('/app/security/api-keys'),
          },
        ],
      },
    ],
  };
}

function buildRootLayer(pathname: string): LayeredSidebarLayer {
  return {
    id: 'application',
    title: 'Application',
    sections: [
      {
        id: 'main',
        title: '',
        items: [
          {
            id: 'overview',
            title: 'Overview',
            icon: icon(Home),
            href: '/app',
            isActive: pathname === '/app',
          },
          {
            id: 'deployments',
            title: 'Deployments',
            icon: icon(FileText),
            href: '/app/deployments',
            isActive: pathname.startsWith('/app/deployments'),
            badge: 3,
          },
        ],
      },
      {
        id: 'ai',
        title: 'AI',
        items: [
          {
            id: 'ai-gateway',
            title: 'AI Gateway',
            icon: icon(Bot),
            href: '/app/ai-gateway',
            isActive: pathname.startsWith('/app/ai-gateway'),
            matchPaths: ['/app/ai-gateway'],
          },
        ],
      },
      {
        id: 'config',
        title: 'Configuration',
        items: [
          {
            id: 'settings',
            title: 'Settings',
            icon: icon(Settings),
            layer: buildSettingsLayer(pathname),
            isActive: pathname.startsWith('/app/settings'),
            matchPaths: ['/app/settings'],
          },
          {
            id: 'security',
            title: 'Security',
            icon: icon(Shield),
            layer: buildSecurityLayer(pathname),
            isActive: pathname.startsWith('/app/security'),
            matchPaths: ['/app/security'],
          },
          {
            id: 'billing',
            title: 'Billing',
            icon: icon(CreditCard),
            href: '/app/billing',
            isActive: pathname.startsWith('/app/billing'),
          },
          {
            id: 'notifications',
            title: 'Notifications',
            icon: icon(Bell),
            href: '/app/notifications',
            isActive: pathname.startsWith('/app/notifications'),
          },
        ],
      },
    ],
  };
}

function PathnameDemo({ initialPath = '/app' }: { initialPath?: string }) {
  const [pathname, setPathname] = React.useState(initialPath);
  const rootLayer = React.useMemo(() => buildRootLayer(pathname), [pathname]);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <LayeredSidebarProvider rootLayer={rootLayer} pathname={pathname}>
            <LayeredSidebarContent />
          </LayeredSidebarProvider>
        </Sidebar>
        <SidebarInset>
          <div className="p-8">
            <h1 className="text-2xl font-bold tracking-tight">Layered Sidebar</h1>
            <p className="mt-1.5 text-muted-foreground">
              Declarative, pathname-driven nested navigation. Click Settings or Security to push a layer, or jump
              directly via the links below.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Current path: <code className="rounded bg-muted px-1.5 py-0.5">{pathname}</code>
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                '/app',
                '/app/deployments',
                '/app/settings',
                '/app/settings/variables',
                '/app/security/api-keys',
                '/app/billing',
              ].map((path) => (
                <Button
                  key={path}
                  size="sm"
                  variant={pathname === path ? 'default' : 'outline'}
                  onClick={() => setPathname(path)}
                >
                  {path}
                </Button>
              ))}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export const Default: Story = {
  render: () => <PathnameDemo />,
};

export const NestedSettings: Story = {
  render: () => <PathnameDemo initialPath="/app/settings/variables" />,
};

function CollapsibleDemo() {
  const [pathname, setPathname] = React.useState('/app/settings');
  const rootLayer = React.useMemo(() => buildRootLayer(pathname), [pathname]);
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex h-screen w-full">
      <Sidebar collapsible="icon">
        <LayeredSidebarProvider rootLayer={rootLayer} pathname={pathname}>
          <LayeredSidebarContent />
        </LayeredSidebarProvider>
      </Sidebar>
      <SidebarInset>
        <div className="p-8">
          <Button onClick={toggleSidebar} variant="outline" size="sm" className="mb-6">
            Toggle collapse
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Icon collapse</h1>
          <p className="mt-1.5 text-muted-foreground">
            Collapse syncs with Harmony&apos;s sidebar state. Layer items show a flyout menu on hover when collapsed.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {['/app', '/app/settings', '/app/settings/domains', '/app/security/password'].map((path) => (
              <Button
                key={path}
                size="sm"
                variant={pathname === path ? 'default' : 'outline'}
                onClick={() => setPathname(path)}
              >
                {path}
              </Button>
            ))}
          </div>
        </div>
      </SidebarInset>
    </div>
  );
}

function CollapsibleWrapper() {
  return (
    <SidebarProvider defaultOpen>
      <CollapsibleDemo />
    </SidebarProvider>
  );
}

export const CollapsibleIcon: Story = {
  render: () => <CollapsibleWrapper />,
};

function StandaloneDemo() {
  const [pathname, setPathname] = React.useState('/app');
  const rootLayer = React.useMemo(() => buildRootLayer(pathname), [pathname]);

  return (
    <div className="flex h-screen w-full">
      <aside className="flex w-[280px] flex-col border-r border-border bg-background">
        <LayeredSidebarProvider rootLayer={rootLayer} pathname={pathname}>
          <LayeredSidebarContent />
        </LayeredSidebarProvider>
      </aside>
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold tracking-tight">Standalone</h1>
        <p className="mt-1.5 text-muted-foreground">
          Works without Harmony&apos;s Sidebar chrome — useful when you bring your own layout shell.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {['/app', '/app/settings/git', '/app/security/api-keys'].map((path) => (
            <Button
              key={path}
              size="sm"
              variant={pathname === path ? 'default' : 'outline'}
              onClick={() => setPathname(path)}
            >
              {path}
            </Button>
          ))}
        </div>
      </main>
    </div>
  );
}

export const Standalone: Story = {
  render: () => <StandaloneDemo />,
};
