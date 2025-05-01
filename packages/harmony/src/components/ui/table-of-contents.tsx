'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { forwardRef, useEffect, useState } from 'react';
import { Headline } from './typography';

type TableOfContentsProps = {
  items: {
    id: string;
    title: string;
    level: number;
  }[];
  className?: string;
  showActiveIndicator?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const TableOfContents = forwardRef<HTMLDivElement, TableOfContentsProps>(
  ({ items, className, showActiveIndicator = true, ...props }, ref) => {
    const [activeId, setActiveId] = useState<string | null>(null);

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

    return (
      <nav ref={ref} className={cn('space-y-2', className)} {...props}>
        <Headline as="h2" className="text-lg font-semibold">
          Table of Contents
        </Headline>
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
  }
);
TableOfContents.displayName = 'TableOfContents';
