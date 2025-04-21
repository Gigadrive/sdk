import type { Meta, StoryObj } from '@storybook/react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
### Tabs Component

A set of layered sections of content that are displayed one at a time. Built on top of Radix UI's Tabs primitive.

#### Features

- **Keyboard Navigation**: Full keyboard support for tab navigation
- **Automatic Activation**: Tabs are automatically activated when focused
- **Responsive Design**: Adapts to different screen sizes
- **Customizable Styling**: Flexible styling options through className props
- **Accessibility**: ARIA-compliant with proper roles and states

#### Best Practices

1. **Content Organization**
   - Group related content under clear tab labels
   - Keep tab labels concise and descriptive
   - Maintain consistent content structure across tabs

2. **Visual Design**
   - Use clear visual indicators for active state
   - Maintain adequate spacing between tabs
   - Ensure sufficient contrast for readability

3. **Accessibility**
   - Provide descriptive labels for screen readers
   - Maintain keyboard navigation support
   - Use appropriate ARIA attributes

#### Usage Guidelines

1. **When to Use**
   - Organizing related content in a compact space
   - Switching between different views or sections
   - Creating form wizards or stepped interfaces

2. **Implementation**
   - Import required components: \`Tabs\`, \`TabsList\`, \`TabsTrigger\`, \`TabsContent\`
   - Structure content with appropriate tab triggers and content
   - Handle tab changes through the \`defaultValue\` or \`value\` prop

3. **Customization**
   - Apply custom styles through className props
   - Modify active state indicators
   - Adjust spacing and layout as needed`,
      },
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A basic tabs implementation with simple content.',
      },
    },
  },
  render: () => (
    <Tabs defaultValue="account" className="w-[400px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <div className="space-y-4 p-4">
          <h4 className="text-sm font-medium">Account Settings</h4>
          <p className="text-sm text-muted-foreground">Manage your account settings and preferences.</p>
        </div>
      </TabsContent>
      <TabsContent value="password">
        <div className="space-y-4 p-4">
          <h4 className="text-sm font-medium">Password Settings</h4>
          <p className="text-sm text-muted-foreground">Change your password and security preferences.</p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};

export const WithIcons: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Tabs with icons in the triggers for visual enhancement.',
      },
    },
  },
  render: () => (
    <Tabs defaultValue="music" className="w-[400px]">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="music" className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          Music
        </TabsTrigger>
        <TabsTrigger value="photos" className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          Photos
        </TabsTrigger>
        <TabsTrigger value="videos" className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m22 8-6 4 6 4V8Z" />
            <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
          </svg>
          Videos
        </TabsTrigger>
      </TabsList>
      <TabsContent value="music">
        <div className="space-y-4 p-4">
          <h4 className="text-sm font-medium">Music Library</h4>
          <p className="text-sm text-muted-foreground">Browse and manage your music collection.</p>
        </div>
      </TabsContent>
      <TabsContent value="photos">
        <div className="space-y-4 p-4">
          <h4 className="text-sm font-medium">Photo Gallery</h4>
          <p className="text-sm text-muted-foreground">View and organize your photo collection.</p>
        </div>
      </TabsContent>
      <TabsContent value="videos">
        <div className="space-y-4 p-4">
          <h4 className="text-sm font-medium">Video Library</h4>
          <p className="text-sm text-muted-foreground">Access your video collection and playlists.</p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};

export const Vertical: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Tabs arranged vertically for a different layout option.',
      },
    },
  },
  render: () => (
    <Tabs defaultValue="profile" orientation="vertical" className="w-[400px]">
      <div className="flex">
        <TabsList className="flex w-[200px] flex-col">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <div className="flex-1">
          <TabsContent value="profile">
            <div className="space-y-4 p-4">
              <h4 className="text-sm font-medium">Profile Settings</h4>
              <p className="text-sm text-muted-foreground">Manage your profile information and preferences.</p>
            </div>
          </TabsContent>
          <TabsContent value="notifications">
            <div className="space-y-4 p-4">
              <h4 className="text-sm font-medium">Notification Preferences</h4>
              <p className="text-sm text-muted-foreground">Configure how you receive notifications.</p>
            </div>
          </TabsContent>
          <TabsContent value="settings">
            <div className="space-y-4 p-4">
              <h4 className="text-sm font-medium">Account Settings</h4>
              <p className="text-sm text-muted-foreground">Manage your account settings and preferences.</p>
            </div>
          </TabsContent>
        </div>
      </div>
    </Tabs>
  ),
};
