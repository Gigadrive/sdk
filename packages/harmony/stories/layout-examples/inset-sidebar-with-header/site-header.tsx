import { type ReactElement } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SearchForm } from 'stories/layout-examples/inset-sidebar-with-header/search-form';
import { Navbar } from '../../../src/components/ui/navbar';

export function SiteHeader(): ReactElement {
  return (
    <Navbar>
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#">Building Your Application</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Data Fetching</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <SearchForm className="w-full sm:ml-auto sm:w-auto" />
    </Navbar>
  );
}
