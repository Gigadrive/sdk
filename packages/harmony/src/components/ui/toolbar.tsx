import { cn } from '@/lib/utils';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { ButtonHTMLAttributes, ComponentProps, CSSProperties, ReactNode } from 'react';
import * as React from 'react';
import { Button } from './button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu';
import { SidebarContext, SidebarTrigger } from './sidebar';

// Predefined positions for the floating toolbar
const POSITION_CLASSES: Record<string, string> = {
  'top-left': 'top-0 left-0',
  'top-right': 'top-0 right-0',
  'bottom-left': 'bottom-0 left-0',
  'bottom-right': 'bottom-0 right-0',
  'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2',
  'top-center': 'top-0 left-1/2 -translate-x-1/2',
};

const SIZE_CLASSES: Record<string, string> = {
  sm: 'gap-0.5 rounded-md',
  md: 'gap-1 p-1 rounded-lg',
  lg: 'gap-2 p-2 rounded-xl',
};

type ToolbarProps = {
  position?: keyof typeof POSITION_CLASSES;
  showWhenSidebarClosed?: boolean;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
  direction?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  offset?: number | string; // px or rem or string
};

const Toolbar: React.FC<ToolbarProps> = ({
  position = 'bottom-center',
  showWhenSidebarClosed = false,
  className,
  children,
  style,
  direction = 'horizontal',
  size = 'md',
  offset = '0.5rem',
}) => {
  // Optionally integrate with Sidebar state
  const sidebar = React.useContext(SidebarContext);
  const [shouldShow, setShouldShow] = React.useState(!showWhenSidebarClosed);

  React.useEffect(() => {
    if (!sidebar) {
      setShouldShow(!showWhenSidebarClosed);
      return;
    }

    setShouldShow(
      !showWhenSidebarClosed ||
        (!sidebar.isMobile && sidebar.state === 'collapsed') ||
        (sidebar.isMobile && !sidebar.openMobile)
    );
  }, [showWhenSidebarClosed, sidebar, sidebar?.state, sidebar?.isMobile, sidebar?.openMobile]);

  if (!shouldShow) return null;

  // Calculate offset style
  const offsetStyle: CSSProperties = {};
  if (offset !== undefined) {
    const val = typeof offset === 'number' ? `${offset}px` : offset;
    if (position.startsWith('top')) offsetStyle.top = val;
    if (position.startsWith('bottom')) offsetStyle.bottom = val;
    if (position.endsWith('left')) offsetStyle.left = val;
    if (position.endsWith('right')) offsetStyle.right = val;
    if (position.endsWith('center')) offsetStyle.left = '50%';
  }

  return (
    <div
      className={cn(
        'fixed z-50',
        'border border-border shadow-lg',
        'bg-sidebar backdrop-blur',
        'transition-all',
        POSITION_CLASSES[position],
        direction === 'vertical' ? 'flex flex-col' : 'flex flex-row',
        SIZE_CLASSES[size],
        className
      )}
      style={{ ...style, ...offsetStyle, pointerEvents: 'auto' }}
      data-toolbar
      data-direction={direction}
      data-size={size}
    >
      {children}
    </div>
  );
};

// Toolbar Button
interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  className?: string;
}
const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ icon, className, onClick, ...props }, ref) => {
    const sidebar = React.useContext(SidebarContext);

    const isSidebarTriggerIcon =
      React.isValidElement(icon) &&
      (icon.type === SidebarTrigger ||
        (icon as React.ReactElement & { type?: { displayName?: string } }).type?.displayName === 'SidebarTrigger');

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (isSidebarTriggerIcon) {
        // If the click originated on the outer button (not the inner icon),
        // toggle here. Otherwise, let the inner SidebarTrigger handle it.
        if (event.target === event.currentTarget) {
          sidebar?.toggleSidebar();
        }
        return;
      }
    };

    return (
      <Button ref={ref} variant="ghost" size="icon" className={className} onClick={handleClick} {...props}>
        {icon && React.isValidElement(icon)
          ? isSidebarTriggerIcon
            ? React.cloneElement(icon as React.ReactElement<{ className?: string; asChild?: boolean }>, {
                asChild: true,
                className: cn('w-6 h-6', (icon as React.ReactElement<{ className?: string }>).props.className),
              })
            : React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
                className: cn('w-6 h-6', (icon as React.ReactElement<{ className?: string }>).props.className),
              })
          : icon}
      </Button>
    );
  }
);
ToolbarButton.displayName = 'ToolbarButton';

// Toolbar Menu Item (Radix DropdownMenu.Item based)
interface ToolbarMenuItemProps extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  inset?: boolean;
}
const ToolbarMenuItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Item>, ToolbarMenuItemProps>(
  ({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        inset && 'pl-8',
        className
      )}
      {...props}
    />
  )
);
ToolbarMenuItem.displayName = 'ToolbarMenuItem';

// Toolbar Menu (Dropdown integration)
interface ToolbarMenuProps extends ComponentProps<typeof DropdownMenu> {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}
const ToolbarMenu: React.FC<ToolbarMenuProps> = ({ icon, children, className, ...props }) => (
  <DropdownMenu {...props}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className={className} tabIndex={0}>
        {icon && React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
              className: cn('w-6 h-6', (icon as React.ReactElement<{ className?: string }>).props.className),
            })
          : icon}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">{children}</DropdownMenuContent>
  </DropdownMenu>
);
ToolbarMenu.displayName = 'ToolbarMenu';

// Export API
export { Toolbar, ToolbarButton, ToolbarMenu, ToolbarMenuItem };
