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

export interface NavbarLogoProps {
  children: React.ReactNode;
}

export interface NavbarContentProps {
  children: React.ReactNode;
}

export interface NavbarActionsProps {
  children: React.ReactNode;
}

const NavbarLogo = React.forwardRef<HTMLDivElement, NavbarLogoProps>(({ children }, ref) => {
  return (
    <div ref={ref} className="flex items-center h-8">
      {children}
    </div>
  );
});
NavbarLogo.displayName = 'NavbarLogo';

const NavbarContent = React.forwardRef<HTMLDivElement, NavbarContentProps>(({ children }, ref) => {
  return (
    <div ref={ref} className="hidden md:flex">
      {children}
    </div>
  );
});
NavbarContent.displayName = 'NavbarContent';

const NavbarActions = React.forwardRef<HTMLDivElement, NavbarActionsProps>(({ children }, ref) => {
  return (
    <div ref={ref} className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
      {children}
    </div>
  );
});
NavbarActions.displayName = 'NavbarActions';

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

          {logo && logoPosition === 'left' && <NavbarLogo>{logo}</NavbarLogo>}

          {logo && logoPosition === 'center' && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <NavbarLogo>{logo}</NavbarLogo>
            </div>
          )}

          {children}
        </div>
      </nav>
    );
  }
);

Navbar.displayName = 'Navbar';

export { Navbar, NavbarActions, NavbarContent, NavbarLogo };
