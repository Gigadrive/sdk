'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, PanelLeft } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

// ─── Shared class constants ──────────────────────────────────────────────────

const ITEM_BASE = cn(
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5',
  'text-sm text-sidebar-foreground/80 outline-none',
  'transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  'focus-visible:ring-2 focus-visible:ring-sidebar-ring',
  'disabled:pointer-events-none disabled:opacity-50'
);

const ITEM_ACTIVE = 'bg-primary/[0.08] text-primary font-medium [&_svg]:text-primary';

const ITEM_COLLAPSED = cn(
  'group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center',
  'group-data-[collapsible=icon]:[&>span]:hidden',
  'group-data-[collapsible=icon]:[&>.sidebar-badge]:hidden',
  'group-data-[collapsible=icon]:[&>.sidebar-chevron]:hidden'
);

// ─── Layer animation variants ────────────────────────────────────────────────

const layerVariants = {
  enter: (direction: 1 | -1) => ({
    x: direction > 0 ? '80%' : '-80%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: 1 | -1) => ({
    x: direction > 0 ? '-80%' : '80%',
    opacity: 0,
  }),
};

const layerTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 35,
  mass: 0.8,
};

// ─── Types ───────────────────────────────────────────────────────────────────

type SidebarVariant = 'default' | 'inset';

interface SidebarContextValue {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  hasNavbar: boolean;
  variant: SidebarVariant;
}

type LayerEntry = {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
};

type LayerContextValue = {
  pushLayer: (entry: Omit<LayerEntry, 'id'>) => void;
  popLayer: () => void;
  depth: number;
};

// ─── Contexts ────────────────────────────────────────────────────────────────

const SidebarCtx = React.createContext<SidebarContextValue | null>(null);
const LayerCtx = React.createContext<LayerContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarCtx);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }
  return context;
}

/**
 * Optional sidebar hook that returns null when used outside a SidebarProvider.
 * Used by navbar/toolbar that may or may not be inside a sidebar layout.
 */
function useSidebarOptional() {
  return React.useContext(SidebarCtx);
}

function useLayer() {
  return React.useContext(LayerCtx);
}

// ─── SidebarProvider ─────────────────────────────────────────────────────────

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** When true, renders as a column layout (navbar on top, sidebars below). */
    hasNavbar?: boolean;
    /** Visual variant. 'inset' renders sidebars on a muted background with the main content in a rounded card. */
    variant?: SidebarVariant;
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      hasNavbar = false,
      variant = 'default',
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);

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

        if (typeof document !== 'undefined') {
          document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
        }
      },
      [setOpenProp, open]
    );

    const toggleSidebar = React.useCallback(() => {
      return isMobile ? setOpenMobile((o) => !o) : setOpen((o) => !o);
    }, [isMobile, setOpen]);

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

    const contextValue = React.useMemo<SidebarContextValue>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
        hasNavbar,
        variant,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar, hasNavbar, variant]
    );

    const isInset = variant === 'inset';

    return (
      <SidebarCtx.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            ref={ref}
            data-has-navbar={hasNavbar || undefined}
            data-variant={variant}
            style={
              {
                '--sidebar-width': SIDEBAR_WIDTH,
                '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              'group/sidebar-wrapper flex h-full w-full',
              isInset ? 'bg-muted/40' : 'bg-background',
              hasNavbar && 'flex-col',
              className
            )}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarCtx.Provider>
    );
  }
);
SidebarProvider.displayName = 'SidebarProvider';

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    side?: 'left' | 'right';
    collapsible?: 'offcanvas' | 'icon' | 'none';
  }
>(({ side = 'left', collapsible = 'offcanvas', className, children, ...props }, ref) => {
  const { isMobile, state, openMobile, setOpenMobile, toggleSidebar, hasNavbar, variant } = useSidebar();
  const isInset = variant === 'inset';

  if (collapsible === 'none') {
    return (
      <div
        ref={ref}
        className={cn(
          'flex h-full w-[var(--sidebar-width)] flex-col text-sidebar-foreground',
          isInset ? 'bg-transparent' : 'bg-background',
          className
        )}
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
          className="w-[var(--sidebar-width)] bg-background p-0 text-sidebar-foreground [&>button]:hidden"
          style={{ '--sidebar-width': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
          side={side}
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  if (hasNavbar) {
    return (
      <div
        ref={ref}
        className={cn(
          'group peer hidden md:flex text-sidebar-foreground',
          'w-[var(--sidebar-width)] shrink-0 transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]',
          !isInset && (side === 'left' ? 'border-r border-sidebar-border' : 'border-l border-sidebar-border'),
          className
        )}
        data-state={state}
        data-collapsible={state === 'collapsed' ? collapsible : ''}
        data-side={side}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className={cn(
            'flex h-full w-full flex-col overflow-x-hidden overflow-y-auto',
            isInset ? 'bg-transparent' : 'bg-background'
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="group peer hidden md:block text-sidebar-foreground"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-side={side}
    >
      {/* Spacer that reserves layout width */}
      <div
        className={cn(
          'relative h-screen w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]'
        )}
      />

      {/* Fixed sidebar panel */}
      <div
        className={cn(
          'fixed inset-y-0 z-10 hidden h-screen w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear md:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:-left-[var(--sidebar-width)]'
            : 'right-0 group-data-[collapsible=offcanvas]:-right-[var(--sidebar-width)]',
          'group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]',
          !isInset && (side === 'left' ? 'border-r border-sidebar-border' : 'border-l border-sidebar-border'),
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className={cn('flex h-full w-full flex-col overflow-x-hidden', isInset ? 'bg-transparent' : 'bg-background')}
        >
          {children}
        </div>

        {/* Resize handle for toggling */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-1.5 cursor-ew-resize transition-colors z-20',
            'hover:bg-sidebar-border/60',
            side === 'left' ? 'right-0 -translate-x-px' : 'left-0 translate-x-px'
          )}
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        />
      </div>

      {/* Edge handle for offcanvas mode (always visible) */}
      <div
        className={cn(
          'fixed top-0 bottom-0 w-1.5 cursor-ew-resize transition-colors z-20',
          'hover:bg-sidebar-border/60',
          'hidden group-data-[collapsible=offcanvas]:block',
          side === 'left' ? 'left-0' : 'right-0'
        )}
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      />
    </div>
  );
});
Sidebar.displayName = 'Sidebar';

// ─── SidebarTrigger ──────────────────────────────────────────────────────────

const SidebarTrigger = React.forwardRef<React.ElementRef<typeof Button>, React.ComponentProps<typeof Button>>(
  ({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();

    return (
      <Button
        ref={ref}
        data-sidebar="trigger"
        variant="ghost"
        size="icon"
        onClick={(event) => {
          onClick?.(event);
          toggleSidebar();
        }}
        className={cn('h-7 w-7', className)}
        {...props}
      >
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    );
  }
);
SidebarTrigger.displayName = 'SidebarTrigger';

// ─── Layout sections ────────────────────────────────────────────────────────

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="header"
    className={cn('flex flex-col gap-2 p-2 group-data-[collapsible=icon]:items-center', className)}
    {...props}
  />
));
SidebarHeader.displayName = 'SidebarHeader';

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="footer"
    className={cn('flex flex-col gap-2 p-2 group-data-[collapsible=icon]:items-center', className)}
    {...props}
  />
));
SidebarFooter.displayName = 'SidebarFooter';

// ─── SidebarContent (Layer Engine) ───────────────────────────────────────────

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, children, ...props }, ref) => {
    const layerIdCounter = React.useRef(0);
    const [layerStack, setLayerStack] = React.useState<LayerEntry[]>([]);
    const [direction, setDirection] = React.useState<1 | -1>(1);

    const pushLayer = React.useCallback((entry: Omit<LayerEntry, 'id'>) => {
      setDirection(1);
      setLayerStack((prev) => [...prev, { ...entry, id: `layer-${++layerIdCounter.current}` }]);
    }, []);

    const popLayer = React.useCallback(() => {
      setDirection(-1);
      setLayerStack((prev) => prev.slice(0, -1));
    }, []);

    const depth = layerStack.length;
    const currentLayer = depth > 0 ? layerStack[depth - 1] : null;
    const currentKey = currentLayer ? currentLayer.id : 'root';

    const layerCtxValue = React.useMemo<LayerContextValue>(
      () => ({ pushLayer, popLayer, depth }),
      [pushLayer, popLayer, depth]
    );

    return (
      <div
        ref={ref}
        data-sidebar="content"
        className={cn('flex min-h-0 flex-1 flex-col relative overflow-hidden', className)}
        {...props}
      >
        <LayerCtx.Provider value={layerCtxValue}>
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentKey}
              custom={direction}
              variants={layerVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={layerTransition}
              className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden p-2 h-full"
            >
              {currentLayer ? (
                <>
                  <LayerBackButton title={currentLayer.title} Icon={currentLayer.icon} onClick={popLayer} />
                  {currentLayer.children}
                </>
              ) : (
                children
              )}
            </motion.div>
          </AnimatePresence>
        </LayerCtx.Provider>
      </div>
    );
  }
);
SidebarContent.displayName = 'SidebarContent';

// ─── LayerBackButton (internal) ──────────────────────────────────────────────

function LayerBackButton({
  title,
  Icon,
  onClick,
}: {
  title: string;
  Icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-md px-1.5 py-1 mb-1',
        'text-xs font-medium text-sidebar-foreground/60',
        'hover:text-sidebar-foreground hover:bg-sidebar-accent',
        'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        'group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:mb-0'
      )}
    >
      <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 group-data-[collapsible=icon]:hidden" />}
      <span className="truncate group-data-[collapsible=icon]:hidden">{title}</span>
    </button>
  );
}

// ─── SidebarGroup ────────────────────────────────────────────────────────────

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    label?: string | React.ReactNode;
  }
>(({ className, label, children, ...props }, ref) => (
  <div ref={ref} data-sidebar="group" className={cn('flex w-full min-w-0 flex-col', className)} {...props}>
    {label && (
      <div
        data-sidebar="group-label"
        className={cn(
          'flex h-7 shrink-0 items-center px-2 text-[0.6875rem] font-medium tracking-wide uppercase',
          'text-sidebar-foreground/40 select-none',
          'group-data-[collapsible=icon]:hidden'
        )}
      >
        {label}
      </div>
    )}
    <ul data-sidebar="menu" className="flex w-full min-w-0 flex-col gap-0.5">
      {children}
    </ul>
  </div>
));
SidebarGroup.displayName = 'SidebarGroup';

// ─── SidebarItem ─────────────────────────────────────────────────────────────

const SidebarItem = React.forwardRef<
  HTMLLIElement,
  Omit<React.ComponentProps<'li'>, 'title'> & {
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    href?: string;
    isActive?: boolean;
    badge?: React.ReactNode;
    tooltip?: string;
    as?: React.ElementType;
  }
>(({ className, icon: Icon, title, href, isActive, badge, tooltip, children, as, ...props }, ref) => {
  const { isMobile, state } = useSidebar();
  const layerCtx = useLayer();
  const hasChildren = React.Children.count(children) > 0;

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (hasChildren && layerCtx) {
        e.preventDefault();
        layerCtx.pushLayer({ title, icon: Icon, children });
      }
    },
    [hasChildren, layerCtx, title, Icon, children]
  );

  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="truncate mt-[var(--text-correction)]">{title}</span>
      {hasChildren && (
        <ChevronLeft className="sidebar-chevron ml-auto h-3.5 w-3.5 shrink-0 rotate-180 text-sidebar-foreground/40" />
      )}
      {badge != null && (
        <span className="sidebar-badge ml-auto flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground/60">
          {badge}
        </span>
      )}
    </>
  );

  const buttonClasses = cn(ITEM_BASE, ITEM_COLLAPSED, isActive && ITEM_ACTIVE, className);

  const button = href ? (
    (() => {
      const Comp = as || 'a';
      return (
        <Comp href={href} className={buttonClasses} onClick={handleClick}>
          {content}
        </Comp>
      );
    })()
  ) : (
    <button className={buttonClasses} onClick={handleClick}>
      {content}
    </button>
  );

  const isCollapsed = state === 'collapsed';
  const effectiveTooltip = tooltip ?? (isCollapsed ? title : undefined);
  const showTooltip = effectiveTooltip && !isMobile && (isCollapsed || !!tooltip);

  const indicator = isActive && (
    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary group-data-[collapsible=icon]:hidden" />
  );

  if (showTooltip) {
    return (
      <li ref={ref} className="relative" {...props}>
        {indicator}
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" align="center">
            {effectiveTooltip}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  return (
    <li ref={ref} className="relative" {...props}>
      {indicator}
      {button}
    </li>
  );
});
SidebarItem.displayName = 'SidebarItem';

// ─── SidebarSkeleton ─────────────────────────────────────────────────────────

const SidebarSkeleton = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'> & { showIcon?: boolean }>(
  ({ className, showIcon = false, ...props }, ref) => {
    const width = React.useMemo(() => `${Math.floor(Math.random() * 40) + 50}%`, []);

    return (
      <div
        ref={ref}
        data-sidebar="menu-skeleton"
        className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
        {...props}
      >
        {showIcon && <Skeleton className="size-4 rounded-md" />}
        <Skeleton className="h-4 flex-1" style={{ maxWidth: width }} />
      </div>
    );
  }
);
SidebarSkeleton.displayName = 'SidebarSkeleton';

// ─── SidebarInset ────────────────────────────────────────────────────────────

const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentProps<'main'>>(({ className, ...props }, ref) => {
  const { variant } = useSidebar();
  const isInset = variant === 'inset';

  return (
    <main
      ref={ref}
      data-sidebar="inset"
      className={cn(
        'flex-1 overflow-y-auto',
        isInset &&
          'my-2 rounded-xl border border-border/60 bg-background shadow-[0_1px_3px_0_rgb(0_0_0/0.04),0_1px_2px_-1px_rgb(0_0_0/0.04),0_0_0_1px_rgb(0_0_0/0.02)]',
        !isInset && 'bg-background',
        className
      )}
      {...props}
    />
  );
});
SidebarInset.displayName = 'SidebarInset';

// ─── Exports ─────────────────────────────────────────────────────────────────

export {
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
  useSidebarOptional,
};
