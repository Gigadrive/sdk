import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { type LucideIcon } from 'lucide-react';
import { type ReactElement } from 'react';

export function NavSecondary({
  items,
  className,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
  }[];
  className?: string;
}): ReactElement {
  return (
    <SidebarMenu label="Support" className={className}>
      {items.map((item) => (
        <SidebarMenuItem
          key={item.title}
          icon={<item.icon className="h-4 w-4" />}
          title={item.title}
          href={item.url}
          tooltip={item.title}
        />
      ))}
    </SidebarMenu>
  );
}
