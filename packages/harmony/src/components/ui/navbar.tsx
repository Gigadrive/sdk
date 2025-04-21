import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { SidebarContext, SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import * as React from 'react';

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  showSidebar?: boolean;
  size?: 'default' | 'sm' | 'lg';
  logo?: React.ReactNode;
  logoPosition?: 'left' | 'center';
}

const Navbar = React.forwardRef<HTMLElement, NavbarProps>(
  ({ className, children, showSidebar = false, size = 'default', logo, logoPosition = 'left', ...props }, ref) => {
    const sidebarContext = React.useContext(SidebarContext);
    const hasSidebar = showSidebar && sidebarContext !== null;

    return (
      <nav
        ref={ref}
        className={cn(
          'flex sticky top-0 z-50 w-full items-center border-b bg-background',
          size === 'sm' ? 'h-12' : size === 'lg' ? 'h-16' : 'h-14',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'flex w-full items-center gap-2 px-4',
            size === 'sm' ? 'h-12' : size === 'lg' ? 'h-16' : 'h-[--header-height]'
          )}
        >
          {hasSidebar && <SidebarTrigger />}
          {logo && logoPosition === 'left' && <div className="flex items-center h-8">{logo}</div>}
          <div className="hidden md:flex">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Getting Started</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                      <li className="row-span-3">
                        <NavigationMenuLink asChild>
                          <a
                            className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                            href="/"
                          >
                            <div className="mb-2 mt-4 text-lg font-medium">Welcome</div>
                            <p className="text-sm leading-tight text-muted-foreground">
                              Get started building your app with our components.
                            </p>
                          </a>
                        </NavigationMenuLink>
                      </li>
                      <ListItem href="/docs" title="Introduction">
                        Learn about our design system and components.
                      </ListItem>
                      <ListItem href="/docs/installation" title="Installation">
                        How to install and setup your development environment.
                      </ListItem>
                      <ListItem href="/docs/components" title="Components">
                        Explore our collection of pre-built components.
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Components</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {components.map((component) => (
                        <ListItem key={component.title} title={component.title} href={component.href}>
                          {component.description}
                        </ListItem>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink
                    className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                    href="/docs"
                  >
                    Documentation
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          {logo && logoPosition === 'center' && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8">{logo}</div>
          )}
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">{children}</div>
      </nav>
    );
  }
);

Navbar.displayName = 'Navbar';

const ListItem = React.forwardRef<React.ElementRef<'a'>, React.ComponentPropsWithoutRef<'a'> & { title: string }>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <li>
        <NavigationMenuLink asChild>
          <a
            ref={ref}
            className={cn(
              'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
              className
            )}
            {...props}
          >
            <div className="text-sm font-medium leading-none">{title}</div>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{children}</p>
          </a>
        </NavigationMenuLink>
      </li>
    );
  }
);
ListItem.displayName = 'ListItem';

const components: { title: string; href: string; description: string }[] = [
  {
    title: 'Alert Dialog',
    href: '/docs/primitives/alert-dialog',
    description: 'A modal dialog that interrupts the user with important content and expects a response.',
  },
  {
    title: 'Hover Card',
    href: '/docs/primitives/hover-card',
    description: 'For sighted users to preview content available behind a link.',
  },
  {
    title: 'Progress',
    href: '/docs/primitives/progress',
    description: 'Displays an indicator showing the completion progress of a task.',
  },
  {
    title: 'Scroll-area',
    href: '/docs/primitives/scroll-area',
    description: 'Visually or semantically separates content.',
  },
  {
    title: 'Tabs',
    href: '/docs/primitives/tabs',
    description: 'A set of layered sections of content—known as tab panels—that are displayed one at a time.',
  },
  {
    title: 'Tooltip',
    href: '/docs/primitives/tooltip',
    description:
      'A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it.',
  },
];

export { Navbar };
