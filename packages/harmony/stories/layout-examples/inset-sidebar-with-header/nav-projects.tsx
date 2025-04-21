import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { ChevronsUpDown, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { type ReactElement } from 'react';

export function NavProjects({
  projects,
}: {
  projects: {
    name: string;
    url: string;
    icon: LucideIcon;
  }[];
}): ReactElement {
  return (
    <SidebarMenu label="Projects">
      {projects.map((project) => (
        <SidebarMenuItem
          key={project.name}
          icon={<project.icon className="h-4 w-4" />}
          title={project.name}
          href={project.url}
          tooltip={project.name}
        />
      ))}
      <SidebarMenuItem icon={<MoreHorizontal className="h-4 w-4" />} title="More" tooltip="More">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <ChevronsUpDown className="mr-2 h-4 w-4" />
              Switch Project
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            <DropdownMenuLabel>Switch to project</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {projects.map((project) => (
                <DropdownMenuItem key={project.name}>
                  <project.icon className="mr-2 h-4 w-4" />
                  {project.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
