'use client';

import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { type LucideIcon } from 'lucide-react';
import { type ReactElement } from 'react';

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}): ReactElement {
  return (
    <SidebarMenu label="Platform">
      {items.map((item) => (
        <SidebarMenuItem
          key={item.title}
          icon={<item.icon className="h-4 w-4" />}
          title={item.title}
          href={item.url}
          isActive={item.isActive}
          defaultOpen={item.isActive}
          tooltip={item.title}
        >
          {item.items?.map((subItem) => (
            <SidebarMenuItem key={subItem.title} title={subItem.title} href={subItem.url} />
          ))}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
