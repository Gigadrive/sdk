'use client';

import { AnimatePresence, domAnimation, LazyMotion, m } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { useSidebarOptional } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LayeredSidebarItem {
  id: string;
  title: string;
  icon?: React.ReactNode;
  href?: string;
  /** Additional URL prefixes that should match this item for layer detection. */
  matchPaths?: string[];
  layer?: LayeredSidebarLayer;
  badge?: string | number;
  isActive?: boolean;
}

export interface LayeredSidebarSection {
  id: string;
  title: string;
  items: LayeredSidebarItem[];
}

export interface LayeredSidebarLayer {
  id: string;
  title: string;
  icon?: React.ReactNode;
  sections: LayeredSidebarSection[];
}

export type LayeredSidebarNavigationDirection = 'forward' | 'backward';

export interface LayeredSidebarContextValue {
  layerStack: LayeredSidebarLayer[];
  currentLayer: LayeredSidebarLayer;
  pushLayer: (layer: LayeredSidebarLayer) => void;
  popLayer: () => void;
  resetToRoot: () => void;
  direction: LayeredSidebarNavigationDirection;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  /** Element type used to render `href` links. Defaults to `'a'`. */
  linkAs: React.ElementType;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const LayeredSidebarContext = React.createContext<LayeredSidebarContextValue | null>(null);

/**
 * Access the layered sidebar navigation state.
 *
 * @throws When used outside a {@link LayeredSidebarProvider}.
 */
export function useLayeredSidebar() {
  const context = React.useContext(LayeredSidebarContext);
  if (!context) {
    throw new Error('useLayeredSidebar must be used within a LayeredSidebarProvider');
  }
  return context;
}

// ─── Path helpers ────────────────────────────────────────────────────────────

function matchesPath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

/**
 * Walk the layer tree and return the deepest stack whose items match `pathname`.
 * Nested layers are preferred over leaf href matches at the same depth.
 */
function findDeepestLayerPath(layer: LayeredSidebarLayer, pathname: string): LayeredSidebarLayer[] {
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

// ─── Provider ────────────────────────────────────────────────────────────────

export interface LayeredSidebarProviderProps {
  rootLayer: LayeredSidebarLayer;
  /** Current location pathname used to derive the active layer stack. */
  pathname: string;
  children: React.ReactNode;
  /**
   * Initial collapsed state when not nested inside a Harmony {@link SidebarProvider}.
   * When nested, collapse follows the parent sidebar's `state` unless overridden via
   * {@link LayeredSidebarContextValue.setIsCollapsed}.
   */
  defaultCollapsed?: boolean;
  /**
   * Component used to render items with an `href`. Defaults to `'a'`.
   * Pass a framework router link (e.g. Next.js `Link`) for client-side navigation.
   */
  linkAs?: React.ElementType;
}

/**
 * Declarative, pathname-driven layered sidebar navigation.
 *
 * Build a tree of {@link LayeredSidebarLayer} objects and nest this provider
 * inside Harmony's {@link Sidebar}. Render {@link LayeredSidebarContent} as a child.
 *
 * @example
 * ```tsx
 * import Link from 'next/link';
 * import { Sidebar, SidebarInset, SidebarProvider } from '@gigadrive/harmony/sidebar';
 * import {
 *   LayeredSidebarContent,
 *   LayeredSidebarProvider,
 * } from '@gigadrive/harmony/layered-sidebar';
 *
 * <SidebarProvider>
 *   <Sidebar>
 *     <LayeredSidebarProvider rootLayer={rootLayer} pathname={pathname} linkAs={Link}>
 *       <LayeredSidebarContent />
 *     </LayeredSidebarProvider>
 *   </Sidebar>
 *   <SidebarInset>{children}</SidebarInset>
 * </SidebarProvider>
 * ```
 */
export function LayeredSidebarProvider({
  rootLayer,
  pathname,
  children,
  defaultCollapsed = false,
  linkAs = 'a',
}: LayeredSidebarProviderProps) {
  const parentSidebar = useSidebarOptional();
  const [navigationState, setNavigationState] = React.useState<{
    routeKey: string;
    stack: LayeredSidebarLayer[];
  } | null>(null);
  const [collapsedOverride, setCollapsedOverride] = React.useState<boolean | null>(null);

  const parentCollapsed = parentSidebar ? parentSidebar.state === 'collapsed' : defaultCollapsed;
  const isCollapsed = collapsedOverride ?? parentCollapsed;
  const setIsCollapsed = React.useCallback((collapsed: boolean) => {
    setCollapsedOverride(collapsed);
  }, []);

  const routeKey = `${rootLayer.id}:${pathname}`;
  const derivedLayerStack = React.useMemo(() => {
    const path = findDeepestLayerPath(rootLayer, pathname);
    return path.length > 0 ? path : [rootLayer];
  }, [rootLayer, pathname]);

  const layerStack = navigationState?.routeKey === routeKey ? navigationState.stack : derivedLayerStack;
  const currentLayer = layerStack[layerStack.length - 1];

  const pushLayer = React.useCallback(
    (layer: LayeredSidebarLayer) => {
      setNavigationState((prev) => {
        const baseStack = prev?.routeKey === routeKey ? prev.stack : derivedLayerStack;
        return { routeKey, stack: [...baseStack, layer] };
      });
    },
    [derivedLayerStack, routeKey]
  );

  const popLayer = React.useCallback(() => {
    setNavigationState((prev) => {
      const baseStack = prev?.routeKey === routeKey ? prev.stack : derivedLayerStack;
      return { routeKey, stack: baseStack.length > 1 ? baseStack.slice(0, -1) : baseStack };
    });
  }, [derivedLayerStack, routeKey]);

  const resetToRoot = React.useCallback(() => {
    setNavigationState({ routeKey, stack: [rootLayer] });
  }, [rootLayer, routeKey]);

  const value = React.useMemo<LayeredSidebarContextValue>(
    () => ({
      layerStack,
      currentLayer,
      pushLayer,
      popLayer,
      resetToRoot,
      direction: 'forward',
      isCollapsed,
      setIsCollapsed,
      linkAs,
    }),
    [layerStack, currentLayer, pushLayer, popLayer, resetToRoot, isCollapsed, setIsCollapsed, linkAs]
  );

  return <LayeredSidebarContext.Provider value={value}>{children}</LayeredSidebarContext.Provider>;
}

// ─── Section header ──────────────────────────────────────────────────────────

export interface LayeredSidebarSectionHeaderProps {
  title: string;
  className?: string;
}

export function LayeredSidebarSectionHeader({ title, className }: LayeredSidebarSectionHeaderProps) {
  const { isCollapsed } = useLayeredSidebar();

  if (isCollapsed) return null;

  return (
    <div className={cn('px-3 pb-1.5 pt-5 first:pt-3', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{title}</span>
    </div>
  );
}

// ─── Header (back button) ────────────────────────────────────────────────────

export interface LayeredSidebarHeaderProps {
  className?: string;
}

export function LayeredSidebarHeader({ className }: LayeredSidebarHeaderProps) {
  const { layerStack, popLayer, isCollapsed } = useLayeredSidebar();

  const isRoot = layerStack.length === 1;
  const currentLayer = layerStack[layerStack.length - 1];

  if (isRoot) return null;

  if (isCollapsed) {
    return (
      <LazyMotion features={domAnimation}>
        <m.div
          className={cn('px-2 pb-1', className)}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <m.button
            type="button"
            onClick={popLayer}
            className={cn(
              'group flex size-9 items-center justify-center rounded-lg',
              'transition-all duration-150 hover:bg-muted/70',
              'outline-none'
            )}
            aria-label="Go back"
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
          >
            <ChevronLeft className="size-4 text-muted-foreground transition-colors duration-150 group-hover:text-foreground" />
          </m.button>
        </m.div>
      </LazyMotion>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        className={cn('px-2 pb-1', className)}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <m.button
          type="button"
          onClick={popLayer}
          className={cn(
            'group flex w-full items-center gap-2.5 rounded-lg px-3 py-2',
            'text-sm text-muted-foreground',
            'transition-all duration-150 hover:bg-muted/70 hover:text-foreground',
            'outline-none'
          )}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.1 }}
        >
          <ChevronLeft className="size-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
          <span className="font-medium">{currentLayer.title}</span>
        </m.button>
      </m.div>
    </LazyMotion>
  );
}

// ─── Item ────────────────────────────────────────────────────────────────────

function ActiveIndicator({ isActive }: { isActive: boolean }) {
  return (
    <AnimatePresence>
      {isActive ? (
        <m.span
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 my-auto h-5 w-[3px] rounded-r-full bg-primary"
        />
      ) : null}
    </AnimatePresence>
  );
}

function CollapsedLayerTooltip({ item }: { item: LayeredSidebarItem }) {
  const { linkAs: LinkComponent } = useLayeredSidebar();

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
                {subItem.icon ? (
                  <span className={cn('size-4 shrink-0', subItem.isActive ? 'text-primary' : 'text-muted-foreground')}>
                    {subItem.icon}
                  </span>
                ) : null}
                <span className="truncate">{subItem.title}</span>
              </LinkComponent>
            ) : null
          )}
        </div>
      ))}
    </div>
  );
}

export interface LayeredSidebarItemProps {
  item: LayeredSidebarItem;
  className?: string;
}

function CollapsedSidebarItem({ item, className }: LayeredSidebarItemProps) {
  const { pushLayer, linkAs: LinkComponent } = useLayeredSidebar();

  const iconContent = (
    <span
      className={cn(
        'flex size-4 items-center justify-center',
        item.isActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      {item.icon}
    </span>
  );

  if (item.layer) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => item.layer && pushLayer(item.layer)}
              className={cn(
                'group relative flex size-9 items-center justify-center rounded-lg',
                'transition-all duration-150',
                'outline-none',
                item.isActive ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted',
                className
              )}
              aria-label={item.title}
            >
              <ActiveIndicator isActive={!!item.isActive} />
              {iconContent}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="p-0">
            <CollapsedLayerTooltip item={item} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (item.href) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <LinkComponent
              href={item.href}
              className={cn(
                'group relative flex size-9 items-center justify-center rounded-lg',
                'transition-all duration-150',
                'outline-none',
                item.isActive ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted',
                className
              )}
              aria-label={item.title}
            >
              <ActiveIndicator isActive={!!item.isActive} />
              {iconContent}
            </LinkComponent>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <span>{item.title}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}

function ExpandedSidebarItem({ item, className }: LayeredSidebarItemProps) {
  const { pushLayer, linkAs: LinkComponent } = useLayeredSidebar();

  const itemContent = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        {item.icon ? (
          <span className={cn('size-4 shrink-0', item.isActive ? 'text-primary' : 'text-muted-foreground')}>
            {item.icon}
          </span>
        ) : null}
        <span className="truncate">{item.title}</span>
      </span>
      {item.badge !== undefined ? (
        <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px] font-medium">
          {item.badge}
        </Badge>
      ) : null}
    </>
  );

  const baseStyles = cn(
    'group relative flex w-full items-center justify-between rounded-lg py-2 pl-3 pr-3 text-sm',
    'transition-all duration-150',
    'outline-none',
    item.isActive
      ? 'bg-primary/10 font-medium text-primary hover:bg-primary/15'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    className
  );

  if (item.layer) {
    return (
      <m.button
        type="button"
        onClick={() => item.layer && pushLayer(item.layer)}
        className={baseStyles}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.1 }}
      >
        <ActiveIndicator isActive={!!item.isActive} />
        {itemContent}
        <ChevronRight className={cn('ml-2 size-4', item.isActive ? 'text-primary' : 'text-muted-foreground')} />
      </m.button>
    );
  }

  if (item.href) {
    return (
      <LinkComponent href={item.href} className={baseStyles}>
        <ActiveIndicator isActive={!!item.isActive} />
        {itemContent}
      </LinkComponent>
    );
  }

  return null;
}

export function LayeredSidebarItem({ item, className }: LayeredSidebarItemProps) {
  const { isCollapsed } = useLayeredSidebar();

  return (
    <LazyMotion features={domAnimation}>
      {isCollapsed ? (
        <CollapsedSidebarItem item={item} className={className} />
      ) : (
        <ExpandedSidebarItem item={item} className={className} />
      )}
    </LazyMotion>
  );
}

// ─── Layer view ──────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.15, ease: 'easeOut' as const },
  },
};

export interface LayeredSidebarLayerViewProps {
  layer: LayeredSidebarLayer;
  className?: string;
}

/**
 * Renders one layer's sections and items with staggered enter animation.
 */
export function LayeredSidebarLayerView({ layer, className }: LayeredSidebarLayerViewProps) {
  const { isCollapsed } = useLayeredSidebar();

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        key={layer.id}
        className={cn('flex flex-col', className)}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {layer.sections.map((section, sectionIndex) => (
          <div key={section.id}>
            {section.title ? (
              <m.div variants={itemVariants}>
                <LayeredSidebarSectionHeader title={section.title} className={sectionIndex === 0 ? 'mt-0' : ''} />
              </m.div>
            ) : null}

            <div className={cn('flex flex-col', isCollapsed ? 'items-center gap-1 px-2' : 'gap-0.5 px-2')}>
              {section.items.map((item) => (
                <m.div key={item.id} variants={itemVariants}>
                  <LayeredSidebarItem item={item} />
                </m.div>
              ))}
            </div>
          </div>
        ))}
      </m.div>
    </LazyMotion>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

export interface LayeredSidebarContentProps {
  className?: string;
}

/**
 * Renders the current layer header and body. Place inside a Harmony {@link Sidebar}.
 */
export function LayeredSidebarContent({ className }: LayeredSidebarContentProps) {
  const { currentLayer, isCollapsed } = useLayeredSidebar();

  return (
    <div className={cn('flex flex-1 flex-col overflow-hidden pt-2', className)}>
      <LayeredSidebarHeader />
      <div className={cn('flex-1 overflow-y-auto', isCollapsed ? 'py-2' : 'pb-4')}>
        <LayeredSidebarLayerView layer={currentLayer} />
      </div>
    </div>
  );
}
