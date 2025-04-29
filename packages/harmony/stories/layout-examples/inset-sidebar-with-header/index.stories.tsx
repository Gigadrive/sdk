import type { Meta, StoryObj } from '@storybook/react';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { SiteHeader } from './site-header';

const meta = {
  title: 'Layout Examples/Inset Sidebar with Header',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
### Inset Sidebar with Header Layout Example

A sophisticated application layout that combines a fixed header with an inset sidebar, creating a modern and functional interface suitable for complex web applications.

#### Features

- **Fixed Header**: Persistent top navigation with key actions and branding
- **Inset Sidebar**: Secondary navigation that sits within the main content area
- **Responsive Layout**: Adapts seamlessly to different screen sizes
- **Content Grid**: Flexible content area with grid-based layout
- **Visual Hierarchy**: Clear separation between navigation and content areas
- **Component Integration**: Seamless integration of header, sidebar, and content components

#### Best Practices

1. **Layout Structure**
   - Maintain consistent header height across all views
   - Use CSS variables for dynamic sizing and spacing
   - Implement proper overflow handling for content areas

2. **Header Design**
   - Keep header content minimal and focused
   - Include essential navigation and actions
   - Ensure branding is visible but not overwhelming

3. **Sidebar Integration**
   - Align sidebar with header for visual consistency
   - Provide clear visual separation from content
   - Implement proper scrolling behavior

4. **Responsive Considerations**
   - Adapt layout for different screen sizes
   - Handle mobile navigation appropriately
   - Maintain functionality across breakpoints

#### Usage Guidelines

1. **When to Use**
   - Applications requiring persistent top-level navigation
   - Interfaces with complex hierarchical structure
   - Systems needing clear content organization

2. **Implementation Considerations**
   - Plan header content carefully
   - Consider navigation hierarchy
   - Account for dynamic content loading

3. **Customization Options**
   - Adjust header height and styling
   - Modify grid layout for content
   - Customize transitions and animations

#### Accessibility

- Ensure proper keyboard navigation
- Maintain focus management
- Provide clear landmark regions
- Include appropriate ARIA labels`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: `
A complete implementation of the inset sidebar with header layout featuring:
- Fixed header with navigation
- Inset sidebar for secondary navigation
- Responsive grid-based content area
- Proper overflow handling
- CSS variable-based sizing`,
      },
    },
  },
  render: () => (
    <div className="w-full min-h-screen flex flex-col">
      <SidebarProvider>
        <div className="h-full w-full">
          <SiteHeader />
          <div className="flex-1 flex w-full">
            <AppSidebar />
            <SidebarInset className="flex-1">
              <div className="flex flex-col gap-2 p-2 h-full w-full">
                <div className="grid grid-rows-[min-content] gap-2 md:grid-cols-3 w-full">
                  <div className="aspect-video rounded-xl bg-muted/50" />
                  <div className="aspect-video rounded-xl bg-muted/50" />
                  <div className="aspect-video rounded-xl bg-muted/50" />
                </div>
                <div className="flex-1 rounded-xl bg-muted/50 w-full" />
              </div>
            </SidebarInset>
          </div>
        </div>
      </SidebarProvider>
    </div>
  ),
};
