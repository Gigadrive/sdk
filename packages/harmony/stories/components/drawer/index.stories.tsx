import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';

const meta: Meta<typeof Drawer> = {
  title: 'Components/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A drawer component that slides in from the bottom of the screen, built on top of Vaul's drawer primitive.

## Features
- Bottom sheet drawer
- Smooth animations
- Customizable content
- Title and description support
- Footer section
- Close button
- Trigger element
- Dark mode compatible
- Accessible by default

## Usage
\`\`\`tsx
<Drawer>
  <DrawerTrigger>Open Drawer</DrawerTrigger>
  <DrawerContent
    title="Drawer Title"
    description="Optional description"
    footer={<Button>Save</Button>}
  >
    {/* Your content here */}
  </DrawerContent>
</Drawer>
\`\`\`

## Accessibility
- Keyboard navigation support
- Focus management
- ARIA attributes
- Screen reader support
- Proper roles and states

## Best Practices
- Keep content focused
- Use clear titles
- Provide clear actions
- Consider content length
- Use appropriate spacing
- Maintain consistent styling
`,
      },
    },
  },
  argTypes: {
    open: {
      description: 'The controlled open state of the drawer',
      control: 'boolean',
    },
    onOpenChange: {
      description: 'Event handler called when the open state of the drawer changes',
      action: 'onOpenChange',
    },
    shouldScaleBackground: {
      description: 'Whether to scale the background when the drawer opens',
      control: 'boolean',
      defaultValue: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Drawer>;

const DrawerDemo = ({ shouldScaleBackground }: { shouldScaleBackground?: boolean }) => {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={shouldScaleBackground}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open Drawer</Button>
      </DrawerTrigger>
      <DrawerContent
        title="Edit Profile"
        description="Make changes to your profile here. Click save when you're done."
        footer={
          <div className="flex gap-2">
            <Button>Save changes</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              placeholder="Enter your name"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              placeholder="Enter your email"
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export const Default: Story = {
  args: {
    shouldScaleBackground: true,
  },
  render: (args) => <DrawerDemo {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Basic drawer with form content, title, description, and footer.',
      },
    },
  },
};

const DrawerWithCustomContent = ({ shouldScaleBackground }: { shouldScaleBackground?: boolean }) => {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={shouldScaleBackground}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open Custom Drawer</Button>
      </DrawerTrigger>
      <DrawerContent
        title="Custom Content"
        description="This drawer demonstrates custom content layout."
        footer={
          <div className="flex gap-2">
            <Button>Confirm</Button>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </div>
        }
      >
        <div className="grid gap-4">
          <div className="rounded-lg border p-4">
            <h3 className="font-medium">Section 1</h3>
            <p className="text-sm text-muted-foreground">This is a custom section with content.</p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-medium">Section 2</h3>
            <p className="text-sm text-muted-foreground">Another custom section with different content.</p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export const WithCustomContent: Story = {
  args: {
    shouldScaleBackground: true,
  },
  render: (args) => <DrawerWithCustomContent {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Drawer with custom content layout and sections.',
      },
    },
  },
};

const DrawerWithLongContent = ({ shouldScaleBackground }: { shouldScaleBackground?: boolean }) => {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={shouldScaleBackground}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open Long Content Drawer</Button>
      </DrawerTrigger>
      <DrawerContent
        title="Long Content Example"
        description="This drawer demonstrates handling of long content with scrolling."
        footer={
          <div className="flex gap-2">
            <Button>Save</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </div>
        }
      >
        <div className="space-y-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4">
              <h3 className="font-medium">Section {i + 1}</h3>
              <p className="text-sm text-muted-foreground">
                This is a section with some content. The drawer should handle scrolling for long content. The content
                area will scroll independently while maintaining the drawer's drag functionality.
              </p>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export const WithLongContent: Story = {
  args: {
    shouldScaleBackground: true,
  },
  render: (args) => <DrawerWithLongContent {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          "Drawer with long scrollable content. The content area scrolls independently while maintaining the drawer's drag functionality.",
      },
    },
  },
};
