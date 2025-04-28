import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, PanelLeft } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// Constants
const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

// Types
type SidebarContext = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  hoverExpand: boolean;
};

// Context
const SidebarContext = React.createContext<SidebarContext | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }

  return context;
}

// Main Components
const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    hoverExpand?: boolean;
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      hoverExpand = false,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);

    // Internal state of the sidebar
    const [_open, _setOpen] = React.useState(defaultOpen);
    const open = openProp ?? _open;
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === 'function' ? value(open) : value;
        if (setOpenProp) {
          setOpenProp(openState);
        } else {
          _setOpen(openState);
        }

        // Set cookie to remember sidebar state
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      },
      [setOpenProp, open]
    );

    // Toggle sidebar
    const toggleSidebar = React.useCallback(() => {
      return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
    }, [isMobile, setOpen, setOpenMobile]);

    // Keyboard shortcut to toggle sidebar
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          toggleSidebar();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleSidebar]);

    const state = open ? 'expanded' : 'collapsed';

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
        hoverExpand,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar, hoverExpand]
    );

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                '--sidebar-width': SIDEBAR_WIDTH,
                '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            className={cn('group/sidebar-wrapper flex min-h-screen w-full bg-sidebar', className)}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    );
  }
);
SidebarProvider.displayName = 'SidebarProvider';

// Simplified Sidebar component
const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    side?: 'left' | 'right';
    variant?: 'sidebar' | 'floating' | 'inset';
    collapsible?: 'offcanvas' | 'icon' | 'none';
    hoverExpand?: boolean;
  }
>(
  (
    {
      side = 'left',
      variant = 'sidebar',
      collapsible = 'offcanvas',
      hoverExpand = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, state, openMobile, setOpenMobile, toggleSidebar } = useSidebar();

    if (collapsible === 'none') {
      return (
        <div
          className={cn('flex h-full w-[var(--sidebar-width)] flex-col bg-sidebar text-sidebar-foreground', className)}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      );
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            className="w-[var(--sidebar-width)] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
            style={
              {
                '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
              } as React.CSSProperties
            }
            side={side}
          >
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      );
    }

    return (
      <div
        ref={ref}
        className="group peer hidden md:block text-sidebar-foreground"
        data-state={state}
        data-collapsible={state === 'collapsed' ? collapsible : ''}
        data-variant={variant}
        data-side={side}
        data-hover-expand={hoverExpand}
      >
        <div
          className={cn(
            'relative h-screen w-[var(--sidebar-width)] bg-transparent transition-all duration-200 ease-linear',
            'group-data-[collapsible=offcanvas]:w-0',
            'group-data-[side=right]:rotate-180',
            variant === 'floating' || variant === 'inset'
              ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem)]'
              : 'group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]'
          )}
        />
        <div
          className={cn(
            'fixed inset-y-0 z-10 hidden h-screen w-[var(--sidebar-width)] transition-all duration-200 ease-linear md:flex',
            side === 'left'
              ? 'left-0 group-data-[collapsible=offcanvas]:-left-[var(--sidebar-width)]'
              : 'right-0 group-data-[collapsible=offcanvas]:-right-[var(--sidebar-width)]',
            variant === 'floating' || variant === 'inset'
              ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem)]'
              : 'group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)] group-data-[side=left]:border-r group-data-[side=right]:border-l',
            hoverExpand && 'group-data-[collapsible=icon]:hover:w-[var(--sidebar-width)]',
            className
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className={cn(
              'flex h-full w-full flex-col bg-sidebar overflow-x-hidden',
              variant === 'floating' && 'rounded-lg border border-sidebar-border shadow-sm',
              variant === 'inset' && 'rounded-lg shadow-sm',
              hoverExpand && 'group-data-[collapsible=icon]:hover:opacity-100',
              'group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:transition-all duration-200',
              hoverExpand && 'group-data-[collapsible=icon]:hover:overflow-y-auto'
            )}
          >
            {children}
          </div>

          {/* Resize handle for toggling sidebar */}
          <div
            className={cn(
              'absolute top-0 bottom-0 w-2 cursor-ew-resize transition-colors z-20',
              'hover:bg-border',
              side === 'left'
                ? 'right-0 -translate-x-1/2 group-data-[state=collapsed]:translate-x-0'
                : 'left-0 translate-x-1/2 group-data-[state=collapsed]:translate-x-0'
            )}
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          />
        </div>

        {/* Additional resize handle for offcanvas mode that's always visible at the edge */}
        <div
          className={cn(
            'fixed top-0 bottom-0 w-2 cursor-ew-resize transition-colors z-20',
            'hover:bg-border',
            'hidden group-data-[collapsible=offcanvas]:block',
            side === 'left' ? 'left-0' : 'right-0'
          )}
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        />
      </div>
    );
  }
);
Sidebar.displayName = 'Sidebar';

// Toggle button for the sidebar
const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button> & { asChild?: boolean }
>(({ className, onClick, asChild, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();

  const Comp = asChild ? 'span' : Button;
  const buttonProps = asChild
    ? {}
    : {
        variant: 'ghost' as const,
        size: 'icon' as const,
      };

  return (
    <Comp
      ref={ref}
      data-sidebar="trigger"
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      className={!asChild ? cn('h-4 w-4', className) : undefined}
      {...buttonProps}
      {...props}
    >
      <PanelLeft className={asChild ? cn('h-4 w-4', className) : undefined} />
      <span className="sr-only">Toggle Sidebar</span>
    </Comp>
  );
});
SidebarTrigger.displayName = 'SidebarTrigger';

// Main content area that adjusts based on sidebar state
const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentProps<'main'>>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        'relative flex min-h-screen flex-1 flex-col bg-background',
        'peer-data-[variant=inset]:min-h-[calc(100vh-1rem)] md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm',
        className
      )}
      {...props}
    />
  );
});
SidebarInset.displayName = 'SidebarInset';

// Simplified sidebar sections
const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, ...props }, ref) => {
  return <div ref={ref} data-sidebar="header" className={cn('flex flex-col gap-2 p-2', className)} {...props} />;
});
SidebarHeader.displayName = 'SidebarHeader';

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, ...props }, ref) => {
  return <div ref={ref} data-sidebar="footer" className={cn('flex flex-col gap-2 p-2', className)} {...props} />;
});
SidebarFooter.displayName = 'SidebarFooter';

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="content"
        className={cn('flex min-h-0 flex-1 flex-col relative', className)}
        {...props}
      >
        <div className="absolute left-0 right-0 top-0 z-10 h-4 bg-gradient-to-b from-sidebar to-transparent z-10 pointer-events-none" />
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-2 group-data-[collapsible=icon]:overflow-hidden group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:overflow-y-auto">
          {children}
        </div>
        <div className="absolute left-0 right-0 bottom-0 z-10 h-4 bg-gradient-to-t from-sidebar to-transparent pointer-events-none" />
      </div>
    );
  }
);
SidebarContent.displayName = 'SidebarContent';

// Simplified menu components
const SidebarMenu = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    label?: string | React.ReactNode;
  }
>(({ className, label, children, ...props }, ref) => {
  return (
    <div ref={ref} data-sidebar="group" className={cn('relative flex w-full min-w-0 flex-col', className)} {...props}>
      {label && (
        <div
          data-sidebar="group-label"
          className={cn(
            'duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-hidden ring-sidebar-ring transition-[margin,opacity] ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
            'group-data-[collapsible=icon]:opacity-0 group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:opacity-100'
          )}
        >
          {label}
        </div>
      )}
      <ul data-sidebar="menu" className="flex w-full min-w-0 flex-col gap-1">
        {children}
      </ul>
    </div>
  );
});
SidebarMenu.displayName = 'SidebarMenu';

// Simplified menu item with built-in collapsible functionality
const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'> & {
    defaultOpen?: boolean;
    icon?: React.ReactNode;
    title?: string | React.ReactNode;
    href?: string;
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  }
>(({ className, defaultOpen, icon, title, href, isActive, tooltip, children, ...props }, ref) => {
  const { isMobile, state, hoverExpand } = useSidebar();
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const hasChildren = React.Children.count(children) > 0;

  if (!hasChildren) {
    const buttonContent = (
      <>
        {icon}
        {title && (
          <span className="group-data-[collapsible=icon]:opacity-0 group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:opacity-100 mt-[var(--text-correction)]">
            {title}
          </span>
        )}
      </>
    );

    const button = (
      <button
        data-sidebar="menu-button"
        data-active={isActive}
        className={cn(
          'flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-2 group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:h-auto group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:w-auto group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:p-2 [&>span:last-child]:truncate [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0',
          'data-[type=user]:group-data-[collapsible=icon]:!h-12 data-[type=user]:group-data-[collapsible=icon]:!w-12 data-[type=user]:group-data-[collapsible=icon]:!p-1 data-[type=user]:group-data-[collapsible=icon]:justify-center',
          className
        )}
      >
        {buttonContent}
      </button>
    );

    if (href) {
      return (
        <li className="group/menu-item relative">
          <a href={href}>{button}</a>
        </li>
      );
    }

    if (tooltip) {
      const tooltipProps = typeof tooltip === 'string' ? { children: tooltip } : tooltip;

      return (
        <li className="group/menu-item relative">
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent
              side="right"
              align="center"
              hidden={state !== 'collapsed' || isMobile || hoverExpand}
              {...tooltipProps}
            />
          </Tooltip>
        </li>
      );
    }

    return <li className="group/menu-item relative">{button}</li>;
  }

  return (
    <li ref={ref} data-sidebar="menu-item" className={cn('group/menu-item relative', className)} {...props}>
      <Collapsible asChild defaultOpen={defaultOpen} onOpenChange={setIsOpen}>
        <>
          <CollapsibleTrigger asChild>
            <button
              data-sidebar="menu-button"
              data-active={isActive}
              className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-2 group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:h-auto group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:w-auto group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:p-2 [&>span:last-child]:truncate [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0"
            >
              {icon}
              {title && (
                <span className="group-data-[collapsible=icon]:opacity-0 group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:opacity-100 mt-[var(--text-correction)]">
                  {title}
                </span>
              )}
              <motion.div className="ml-auto" animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="size-4" />
              </motion.div>
              <span className="sr-only">Toggle</span>
            </button>
          </CollapsibleTrigger>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: 'auto',
                  opacity: 1,
                  transition: {
                    height: { duration: 0.3, ease: 'easeOut' },
                    opacity: { duration: 0.2, delay: 0.1 },
                  },
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                  transition: {
                    height: { duration: 0.3, ease: 'easeIn' },
                    opacity: { duration: 0.2 },
                  },
                }}
                style={{ overflow: 'hidden' }}
              >
                <ul
                  data-sidebar="menu-sub"
                  className="mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:block"
                >
                  {React.Children.map(children, (child, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        transition: {
                          delay: index * 0.05,
                          duration: 0.2,
                        },
                      }}
                    >
                      {child}
                    </motion.div>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      </Collapsible>
    </li>
  );
});
SidebarMenuItem.displayName = 'SidebarMenuItem';

// Simplified submenu item
const SidebarSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'> & {
    title: string;
    href: string;
    isActive?: boolean;
  }
>(({ className, title, href, isActive, ...props }, ref) => {
  return (
    <li ref={ref} data-sidebar="menu-sub-item" className={cn('group/menu-sub-item relative', className)} {...props}>
      <a
        href={href}
        data-active={isActive}
        className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground [&>span:last-child]:truncate"
      >
        <span>{title}</span>
      </a>
    </li>
  );
});
SidebarSubItem.displayName = 'SidebarSubItem';

// Input for search/filtering
const SidebarInput = React.forwardRef<React.ElementRef<typeof Input>, React.ComponentProps<typeof Input>>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        data-sidebar="input"
        className={cn(
          'h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          className
        )}
        {...props}
      />
    );
  }
);
SidebarInput.displayName = 'SidebarInput';

// Badge for menu items
const SidebarBadge = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="menu-badge"
    className={cn(
      'absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none pointer-events-none',
      'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
      'peer-data-[size=sm]/menu-button:top-1',
      'peer-data-[size=default]/menu-button:top-1.5',
      'peer-data-[size=lg]/menu-button:top-2.5',
      'group-data-[collapsible=icon]:hidden group-data-[hover-expand=true]:group-data-[collapsible=icon]:group-hover:block',
      className
    )}
    {...props}
  />
));
SidebarBadge.displayName = 'SidebarBadge';

// Skeleton for loading states
const SidebarSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    showIcon?: boolean;
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  }, []);

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn('rounded-md h-8 flex gap-2 px-2 items-center', className)}
      {...props}
    >
      {showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
      <Skeleton
        className="h-4 flex-1 max-w-[var(--skeleton-width)]"
        data-sidebar="menu-skeleton-text"
        style={
          {
            '--skeleton-width': width,
          } as React.CSSProperties
        }
      />
    </div>
  );
});
SidebarSkeleton.displayName = 'SidebarSkeleton';

export {
  Sidebar,
  SidebarBadge,
  SidebarContent,
  SidebarContext,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSkeleton,
  SidebarSubItem,
  SidebarTrigger,
  useSidebar,
};
