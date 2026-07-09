'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react';
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
/** Fits size-9 icon buttons with p-2 content padding (Network rail width). */
const SIDEBAR_WIDTH_ICON = '3.25rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

// ─── Shared class constants (Network layered-sidebar chrome) ─────────────────

const ITEM_BASE = cn(
  'group/menu-item relative flex w-full items-center justify-between rounded-lg pl-3 pr-3 py-2',
  'text-sm text-muted-foreground outline-none',
  'transition-all duration-150 hover:bg-muted hover:text-foreground',
  'focus-visible:ring-2 focus-visible:ring-sidebar-ring',
  'disabled:pointer-events-none disabled:opacity-50'
);

const ITEM_ACTIVE = 'bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary';

const ITEM_COLLAPSED = cn(
  // Override w-full from ITEM_BASE so icon buttons stay square in the rail.
  'group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!w-9',
  'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0',
  'group-data-[collapsible=icon]:gap-0',
  'group-data-[collapsible=icon]:[&>.sidebar-item-label]:hidden',
  'group-data-[collapsible=icon]:[&>.sidebar-badge]:hidden',
  'group-data-[collapsible=icon]:[&>.sidebar-chevron]:hidden'
);

const ITEM_BADGE = cn(
  'sidebar-badge ml-auto px-1.5 py-0 text-[10px] font-medium',
  'rounded-md bg-secondary text-secondary-foreground'
);

function activeIndicatorClass(side: 'left' | 'right') {
  return cn(
    'pointer-events-none absolute inset-y-0 my-auto h-5 w-[3px] bg-primary',
    side === 'left' ? 'left-0 rounded-r-full' : 'right-0 rounded-l-full'
  );
}

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

/** Icon accepted by declarative sidebar nav items and layers. */
export type SidebarIcon = React.ComponentType<{ className?: string }> | React.ReactNode;

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

/**
 * Declarative nav item for pathname-driven layered sidebars.
 * Nest a {@link SidebarNavLayer} on `layer` to push a sub-view on click.
 */
export interface SidebarNavItem {
  id: string;
  title: string;
  icon?: SidebarIcon;
  href?: string;
  /** Additional URL prefixes that should match this item for layer detection. */
  matchPaths?: string[];
  layer?: SidebarNavLayer;
  badge?: React.ReactNode;
  isActive?: boolean;
}

export interface SidebarNavSection {
  id: string;
  title: string;
  items: SidebarNavItem[];
}

export interface SidebarNavLayer {
  id: string;
  title: string;
  icon?: SidebarIcon;
  sections: SidebarNavSection[];
}

/** Imperative layer entry pushed by nested `SidebarItem` children. */
export type SidebarLayerEntry = {
  title: string;
  icon?: SidebarIcon;
  children: React.ReactNode;
};

type LayerEntry = SidebarLayerEntry & { id: string };

/** Value returned by {@link useSidebarLayer}. */
export type SidebarLayerContextValue = {
  /** Imperative push used by nested SidebarItem children. */
  pushLayer: (entry: SidebarLayerEntry) => void;
  /** Declarative push used when SidebarContent is driven by `rootLayer`. */
  pushNavLayer: (layer: SidebarNavLayer) => void;
  popLayer: () => void;
  depth: number;
  /** Element type used to render `href` links in declarative mode. */
  linkAs: React.ElementType;
};

// ─── Contexts ────────────────────────────────────────────────────────────────

const SidebarCtx = React.createContext<SidebarContextValue | null>(null);
const LayerCtx = React.createContext<SidebarLayerContextValue | null>(null);

type SidebarLayoutValue = {
  side: 'left' | 'right';
  /** Always render icon-only item chrome (e.g. a fixed right toolbar rail). */
  iconRail: boolean;
};

const SidebarLayoutCtx = React.createContext<SidebarLayoutValue>({ side: 'left', iconRail: false });

function useSidebar() {
  const context = React.useContext(SidebarCtx);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }
  return context;
}

function useSidebarLayout() {
  return React.useContext(SidebarLayoutCtx);
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

function useSidebarLayer() {
  const context = React.useContext(LayerCtx);
  if (!context) {
    throw new Error('useSidebarLayer must be used within SidebarContent.');
  }
  return context;
}

function matchesPath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

/**
 * Walk a declarative layer tree and return the deepest stack whose items match `pathname`.
 * Nested layers are preferred over leaf href matches at the same depth.
 */
function findDeepestLayerPath(layer: SidebarNavLayer, pathname: string): SidebarNavLayer[] {
  for (const section of layer.sections) {
    for (const item of section.items) {
      if (item.layer) {
        const deeper = findDeepestLayerPath(item.layer, pathname);
        if (deeper.length > 0) {
          return [layer, ...deeper];
        }
      }
    }
  }

  for (const section of layer.sections) {
    for (const item of section.items) {
      if (item.href && matchesPath(pathname, item.href)) {
        return [layer];
      }
      if (item.matchPaths) {
        for (const matchPath of item.matchPaths) {
          if (matchesPath(pathname, matchPath)) {
            return [layer];
          }
        }
      }
    }
  }

  return [];
}

function renderSidebarIcon(icon: SidebarIcon | undefined, className: string) {
  if (!icon) return null;
  if (React.isValidElement(icon)) {
    return icon;
  }
  const Icon = icon as React.ComponentType<{ className?: string }>;
  return <Icon className={className} />;
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
    /**
     * Force icon-only item chrome regardless of open/collapsed state.
     * Useful for fixed toolbar rails (`collapsible="none"` + icon width).
     */
    iconRail?: boolean;
  }
>(({ side = 'left', collapsible = 'offcanvas', iconRail = false, className, children, ...props }, ref) => {
  const { isMobile, state, openMobile, setOpenMobile, toggleSidebar, hasNavbar, variant } = useSidebar();
  const isInset = variant === 'inset';

  const content = <SidebarLayoutCtx.Provider value={{ side, iconRail }}>{children}</SidebarLayoutCtx.Provider>;

  if (collapsible === 'none') {
    return (
      <div
        ref={ref}
        className={cn(
          'group flex h-full flex-col text-sidebar-foreground',
          iconRail ? 'w-[var(--sidebar-width-icon)]' : 'w-[var(--sidebar-width)]',
          isInset ? 'bg-transparent' : 'bg-background',
          className
        )}
        data-side={side}
        data-collapsible={iconRail ? 'icon' : ''}
        {...props}
      >
        {content}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-mobile="true"
          data-side={side}
          className="w-[var(--sidebar-width)] bg-background p-0 text-sidebar-foreground [&>button]:hidden"
          style={{ '--sidebar-width': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
          side={side}
        >
          <div className="flex h-full w-full flex-col">{content}</div>
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
          {content}
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
          'relative h-svh w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]'
        )}
      />

      {/* Fixed sidebar panel */}
      <div
        className={cn(
          'fixed inset-y-0 z-10 hidden h-svh w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear md:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
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
          {content}
        </div>

        {/* Resize handle for toggling */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-1.5 cursor-ew-resize transition-colors z-20',
            'hover:bg-sidebar-border/60',
            side === 'left' ? 'right-0' : 'left-0'
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

export interface SidebarContentProps extends React.ComponentProps<'div'> {
  /**
   * Declarative root layer. When set, `SidebarContent` renders the active layer
   * from this tree (driven by `pathname`) instead of composing children.
   */
  rootLayer?: SidebarNavLayer;
  /**
   * Current location pathname used to derive the active layer stack.
   * Required when `rootLayer` is provided.
   */
  pathname?: string;
  /**
   * Component used to render items with an `href` in declarative mode.
   * Defaults to `'a'`. Pass a framework router link (e.g. Next.js `Link`).
   */
  linkAs?: React.ElementType;
}

const SidebarContent = React.forwardRef<HTMLDivElement, SidebarContentProps>(
  ({ className, children, rootLayer, pathname, linkAs = 'a', ...props }, ref) => {
    const layerIdCounter = React.useRef(0);
    const [imperativeStack, setImperativeStack] = React.useState<LayerEntry[]>([]);
    const [direction, setDirection] = React.useState<1 | -1>(1);
    const [navOverride, setNavOverride] = React.useState<{
      routeKey: string;
      stack: SidebarNavLayer[];
    } | null>(null);

    const isDeclarative = rootLayer != null;

    const routeKey = isDeclarative ? `${rootLayer.id}:${pathname ?? ''}` : '';
    const derivedNavStack = React.useMemo(() => {
      if (!rootLayer) return [] as SidebarNavLayer[];
      const path = findDeepestLayerPath(rootLayer, pathname ?? '');
      return path.length > 0 ? path : [rootLayer];
    }, [rootLayer, pathname]);

    const navStack = isDeclarative && navOverride?.routeKey === routeKey ? navOverride.stack : derivedNavStack;

    React.useEffect(() => {
      if (!isDeclarative) return;
      setImperativeStack([]);
    }, [isDeclarative, routeKey]);

    const pushLayer = React.useCallback((entry: SidebarLayerEntry) => {
      setDirection(1);
      setImperativeStack((prev) => [...prev, { ...entry, id: `layer-${++layerIdCounter.current}` }]);
    }, []);

    const pushNavLayer = React.useCallback(
      (layer: SidebarNavLayer) => {
        if (!isDeclarative) return;
        setDirection(1);
        setNavOverride((prev) => {
          const baseStack = prev?.routeKey === routeKey ? prev.stack : derivedNavStack;
          return { routeKey, stack: [...baseStack, layer] };
        });
        setImperativeStack([]);
      },
      [derivedNavStack, isDeclarative, routeKey]
    );

    const imperativeStackRef = React.useRef(imperativeStack);
    imperativeStackRef.current = imperativeStack;

    const popLayer = React.useCallback(() => {
      setDirection(-1);
      if (imperativeStackRef.current.length > 0) {
        setImperativeStack((prev) => prev.slice(0, -1));
        return;
      }
      if (isDeclarative) {
        setNavOverride((navPrev) => {
          const baseStack = navPrev?.routeKey === routeKey ? navPrev.stack : derivedNavStack;
          return { routeKey, stack: baseStack.length > 1 ? baseStack.slice(0, -1) : baseStack };
        });
      }
    }, [derivedNavStack, isDeclarative, routeKey]);

    const depth = isDeclarative ? Math.max(0, navStack.length - 1) + imperativeStack.length : imperativeStack.length;

    const currentImperative = imperativeStack.length > 0 ? imperativeStack[imperativeStack.length - 1] : null;
    const currentNav = isDeclarative ? navStack[navStack.length - 1] : null;
    const currentKey = currentImperative ? currentImperative.id : currentNav ? currentNav.id : 'root';

    const layerCtxValue = React.useMemo<SidebarLayerContextValue>(
      () => ({ pushLayer, pushNavLayer, popLayer, depth, linkAs }),
      [pushLayer, pushNavLayer, popLayer, depth, linkAs]
    );

    let body: React.ReactNode;
    if (currentImperative) {
      body = (
        <>
          <LayerBackButton title={currentImperative.title} icon={currentImperative.icon} onClick={popLayer} />
          {currentImperative.children}
        </>
      );
    } else if (isDeclarative && currentNav) {
      body = (
        <>
          {navStack.length > 1 ? (
            <LayerBackButton title={currentNav.title} icon={currentNav.icon} onClick={popLayer} />
          ) : null}
          <DeclarativeLayerView layer={currentNav} />
        </>
      );
    } else {
      body = children;
    }

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
              className="scroll-fade flex h-full flex-col gap-1 overflow-x-hidden overflow-y-auto p-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1.5"
            >
              {body}
            </motion.div>
          </AnimatePresence>
        </LayerCtx.Provider>
      </div>
    );
  }
);
SidebarContent.displayName = 'SidebarContent';

// ─── LayerBackButton (internal) ──────────────────────────────────────────────

function LayerBackButton({ title, onClick }: { title: string; icon?: SidebarIcon; onClick: () => void }) {
  return (
    <div className="w-full pb-1 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center">
      <button
        type="button"
        onClick={onClick}
        aria-label="Go back"
        className={cn(
          'group/back flex w-full items-center gap-2.5 rounded-lg px-3 py-2 outline-none',
          'text-sm text-muted-foreground',
          'transition-all duration-150 hover:bg-muted/70 hover:text-foreground',
          'focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          'group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!w-9',
          'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0',
          'group-data-[collapsible=icon]:p-0'
        )}
      >
        <ChevronLeft className="size-4 shrink-0 transition-transform duration-150 group-hover/back:-translate-x-0.5 group-data-[collapsible=icon]:group-hover/back:translate-x-0" />
        <span className="truncate font-medium group-data-[collapsible=icon]:hidden">{title}</span>
      </button>
    </div>
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
    {label ? (
      <div
        data-sidebar="group-label"
        className={cn('px-3 pb-1.5 pt-5 first:pt-3 select-none', 'group-data-[collapsible=icon]:hidden')}
      >
        {typeof label === 'string' || typeof label === 'number' ? (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</span>
        ) : (
          label
        )}
      </div>
    ) : null}
    <ul
      data-sidebar="menu"
      className="flex w-full min-w-0 flex-col gap-0.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1"
    >
      {children}
    </ul>
  </div>
));
SidebarGroup.displayName = 'SidebarGroup';

// ─── Declarative layer rendering ─────────────────────────────────────────────

function DeclarativeLayerView({ layer }: { layer: SidebarNavLayer }) {
  return (
    <>
      {layer.sections.map((section) => (
        <SidebarGroup key={section.id} label={section.title || undefined}>
          {section.items.map((item) => (
            <DeclarativeSidebarItem key={item.id} item={item} />
          ))}
        </SidebarGroup>
      ))}
    </>
  );
}

function CollapsedLayerFlyout({ item }: { item: SidebarNavItem }) {
  const layerCtx = useLayer();
  const LinkComponent = layerCtx?.linkAs ?? 'a';

  if (!item.layer) return null;

  return (
    <div className="min-w-[180px] py-2">
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {item.title}
      </div>
      {item.layer.sections.map((section) => (
        <div key={section.id}>
          {section.items.map((subItem) =>
            subItem.href ? (
              <LinkComponent
                key={subItem.id}
                href={subItem.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 text-sm transition-all duration-150',
                  subItem.isActive
                    ? 'bg-primary/10 font-medium text-primary hover:bg-primary/15'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {renderSidebarIcon(
                  subItem.icon,
                  cn('size-4 shrink-0', subItem.isActive ? 'text-primary' : 'text-muted-foreground')
                )}
                <span className="truncate">{subItem.title}</span>
              </LinkComponent>
            ) : null
          )}
        </div>
      ))}
    </div>
  );
}

function DeclarativeSidebarItem({ item }: { item: SidebarNavItem }) {
  const { isMobile, state } = useSidebar();
  const { side, iconRail } = useSidebarLayout();
  const layerCtx = useLayer();
  const isCollapsed = iconRail || state === 'collapsed';
  const LinkComponent = layerCtx?.linkAs ?? 'a';
  const hasLayer = item.layer != null;
  const tooltipSide = side === 'right' ? 'left' : 'right';

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (hasLayer && item.layer && layerCtx) {
        e.preventDefault();
        layerCtx.pushNavLayer(item.layer);
      }
    },
    [hasLayer, item.layer, layerCtx]
  );

  const iconClass = cn('size-4 shrink-0', item.isActive ? 'text-primary' : 'text-muted-foreground');

  const content = (
    <>
      <span className="sidebar-item-label flex min-w-0 items-center gap-2.5">
        {renderSidebarIcon(item.icon, iconClass)}
        <span className="truncate">{item.title}</span>
      </span>
      {item.badge != null ? <span className={ITEM_BADGE}>{item.badge}</span> : null}
      {hasLayer ? (
        <ChevronRight
          className={cn(
            'sidebar-chevron ml-2 size-4 shrink-0',
            item.isActive ? 'text-primary' : 'text-muted-foreground'
          )}
        />
      ) : null}
    </>
  );

  const collapsedContent = (
    <span
      className={cn(
        'sidebar-item-icon flex size-4 items-center justify-center',
        item.isActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      {renderSidebarIcon(item.icon, 'size-4 shrink-0')}
    </span>
  );

  const buttonClasses = cn(ITEM_BASE, ITEM_COLLAPSED, item.isActive && ITEM_ACTIVE);

  let button: React.ReactNode;
  if (hasLayer) {
    button = (
      <button type="button" className={buttonClasses} onClick={handleClick} aria-label={item.title}>
        {isCollapsed && !isMobile ? collapsedContent : content}
      </button>
    );
  } else if (item.href) {
    button = (
      <LinkComponent href={item.href} className={buttonClasses} onClick={handleClick} aria-label={item.title}>
        {isCollapsed && !isMobile ? collapsedContent : content}
      </LinkComponent>
    );
  } else {
    return null;
  }

  const indicator = item.isActive ? <span className={activeIndicatorClass(side)} /> : null;

  if (isCollapsed && !isMobile) {
    return (
      <li className="relative flex w-full justify-center group-data-[collapsible=icon]:w-auto">
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side={tooltipSide} sideOffset={8} className={hasLayer ? 'p-0' : undefined}>
            {hasLayer ? <CollapsedLayerFlyout item={item} /> : item.title}
          </TooltipContent>
        </Tooltip>
        {indicator}
      </li>
    );
  }

  return (
    <li className="relative">
      {button}
      {indicator}
    </li>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively checks if any descendant SidebarItem has isActive set. */
function hasActiveDescendant(children: React.ReactNode): boolean {
  let found = false;
  React.Children.forEach(children, (child) => {
    if (found) return;
    if (!React.isValidElement(child)) return;
    if (child.props.isActive) {
      found = true;
      return;
    }
    if (child.props.children) {
      found = hasActiveDescendant(child.props.children);
    }
  });
  return found;
}

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
  const { side, iconRail } = useSidebarLayout();
  const layerCtx = useLayer();
  const hasChildren = React.Children.count(children) > 0;
  const tooltipSide = side === 'right' ? 'left' : 'right';

  const childActive = hasChildren && hasActiveDescendant(children);
  const effectiveActive = isActive || childActive;

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
      <span className="sidebar-item-label flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <Icon className={cn('size-4 shrink-0', effectiveActive ? 'text-primary' : 'text-muted-foreground')} />
        ) : null}
        <span className="truncate">{title}</span>
      </span>
      {badge != null ? <span className={ITEM_BADGE}>{badge}</span> : null}
      {hasChildren ? (
        <ChevronRight
          className={cn(
            'sidebar-chevron ml-2 size-4 shrink-0',
            effectiveActive ? 'text-primary' : 'text-muted-foreground'
          )}
        />
      ) : null}
    </>
  );

  const collapsedContent = (
    <span
      className={cn(
        'sidebar-item-icon flex size-4 items-center justify-center',
        effectiveActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
    </span>
  );

  const isCollapsed = iconRail || state === 'collapsed';
  const buttonClasses = cn(ITEM_BASE, ITEM_COLLAPSED, effectiveActive && ITEM_ACTIVE, className);
  const showCollapsedChrome = (iconRail || isCollapsed) && !isMobile;

  const button = href ? (
    (() => {
      const Comp = as || 'a';
      return (
        <Comp href={href} className={buttonClasses} onClick={handleClick} aria-label={title}>
          {showCollapsedChrome ? collapsedContent : content}
        </Comp>
      );
    })()
  ) : (
    <button type="button" className={buttonClasses} onClick={handleClick} aria-label={title}>
      {showCollapsedChrome ? collapsedContent : content}
    </button>
  );

  const effectiveTooltip = isCollapsed ? (tooltip ?? title) : tooltip;
  const showTooltip = Boolean(effectiveTooltip) && !isMobile;

  const indicator = effectiveActive ? <span className={activeIndicatorClass(side)} /> : null;

  if (showTooltip) {
    return (
      <li
        ref={ref}
        className="relative flex w-full group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center"
        {...props}
      >
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side={tooltipSide} sideOffset={8} align="center">
            {effectiveTooltip}
          </TooltipContent>
        </Tooltip>
        {indicator}
      </li>
    );
  }

  return (
    <li
      ref={ref}
      className="relative flex w-full group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center"
      {...props}
    >
      {button}
      {indicator}
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
        'scroll-fade flex-1 overflow-y-auto',
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
  useSidebarLayer,
  useSidebarOptional,
};
