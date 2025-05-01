'use client';

import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { forwardRef, useEffect, useState } from 'react';
import { Button } from './button';
import { Drawer, DrawerContent, DrawerTrigger } from './drawer';

// Predefined positions for the floating button
const POSITION_CLASSES: Record<string, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
};

type TableOfContentsProps = {
  items: {
    id: string;
    title: string;
    level: number;
  }[];
  className?: string;
  showActiveIndicator?: boolean;
  mobilePosition?: keyof typeof POSITION_CLASSES;
  mobileOffset?: number | string; // px or rem or string
  responsive?: boolean; // Whether to show mobile drawer or always show sidebar
} & React.HTMLAttributes<HTMLDivElement>;

export const TableOfContents = forwardRef<HTMLDivElement, TableOfContentsProps>(
  (
    {
      items,
      className,
      showActiveIndicator = true,
      mobilePosition = 'bottom-right',
      mobileOffset,
      responsive = true,
      ...props
    },
    ref
  ) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const isMobile = useIsMobile();

    useEffect(() => {
      if (!showActiveIndicator) return;

      const observer =
        typeof window === 'undefined'
          ? null!
          : new IntersectionObserver(
              (entries) => {
                entries.forEach((entry) => {
                  if (entry.isIntersecting) {
                    setActiveId(entry.target.id);
                  }
                });
              },
              {
                rootMargin: `0px 0% -80%`,
              }
            );

      items.forEach((item) => {
        const element = document.getElementById(item.id);
        if (element) observer.observe(element);
      });

      return () => {
        items.forEach((item) => {
          const element = document.getElementById(item.id);
          if (element) observer.unobserve(element);
        });
      };
    }, [items, showActiveIndicator]);

    const renderContents = () => (
      <nav ref={ref} className={cn('space-y-2', className)} {...props}>
        <ul className="space-y-1 relative">
          {items.map((item) => (
            <motion.li
              key={item.id}
              className={cn(
                'text-sm text-muted-foreground hover:text-foreground transition-colors relative',
                `ml-${(item.level - 1) * 4}`,
                activeId === item.id && 'text-foreground'
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              <a href={`#${item.id}`} className="block py-1 relative">
                {item.title}
                {showActiveIndicator && activeId === item.id && (
                  <motion.div
                    className="absolute inset-0 -inset-x-2 bg-primary/20 rounded-full -z-10"
                    layoutId="activeIndicator"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </a>
            </motion.li>
          ))}
        </ul>
      </nav>
    );

    // Calculate offset style for mobile button
    const offsetStyle: React.CSSProperties = {};
    if (mobileOffset !== undefined) {
      const val = typeof mobileOffset === 'number' ? `${mobileOffset}px` : mobileOffset;
      if (mobilePosition.startsWith('top')) offsetStyle.top = val;
      if (mobilePosition.startsWith('bottom')) offsetStyle.bottom = val;
      if (mobilePosition.endsWith('left')) offsetStyle.left = val;
      if (mobilePosition.endsWith('right')) offsetStyle.right = val;
      if (mobilePosition.endsWith('center')) offsetStyle.left = '50%';
    }

    if (responsive && isMobile) {
      return (
        <div className={cn('fixed z-50 md:hidden', POSITION_CLASSES[mobilePosition])} style={offsetStyle}>
          <Drawer>
            <DrawerTrigger asChild>
              <Button size="icon" className="rounded-full shadow-lg" aria-label="Open table of contents">
                <Menu className="h-4 w-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent title="Table of Contents" className="max-h-[80vh]">
              {renderContents()}
            </DrawerContent>
          </Drawer>
        </div>
      );
    }

    return renderContents();
  }
);
TableOfContents.displayName = 'TableOfContents';
