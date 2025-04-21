import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const meta: Meta<typeof Dialog> = {
  title: 'Components/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A dialog component built on top of Radix UI's Dialog primitive, providing a way to display content in a modal overlay.

## Features
- Modal overlay with backdrop
- Multiple size options (sm, md, lg, full)
- Loading state support
- Centered text option
- Customizable styling
- Dark mode compatible
- Accessible by default
- Keyboard navigation
- Focus management
- Animation support

## Subcomponents
- \`Dialog\`: The root container component
- \`DialogTrigger\`: The button that opens the dialog
- \`DialogContent\`: The main content container
- \`DialogHeader\`: Container for the dialog header
- \`DialogFooter\`: Container for the dialog footer
- \`DialogTitle\`: The dialog title
- \`DialogDescription\`: The dialog description
- \`DialogClose\`: The close button
- \`DialogOverlay\`: The backdrop overlay
- \`DialogPortal\`: The portal for rendering the dialog

## Accessibility
- WAI-ARIA compliant dialog pattern
- Keyboard navigation (Esc to close)
- Focus management
- Proper ARIA states
- Screen reader announcements
- Focus visible indicators
- Focus trap within dialog

## Usage Guidelines
- Use for important actions
- Use for forms
- Use for confirmations
- Use for detailed information
- Use for settings
- Consider mobile interactions
- Maintain consistent behavior

## Best Practices
- Keep content concise
- Use clear, actionable titles
- Provide clear actions
- Consider dialog size
- Maintain consistent styling
- Use appropriate animations
- Consider loading states
- Consider mobile viewports

## Props
- \`open\`: Controlled open state
- \`defaultOpen\`: Default open state
- \`onOpenChange\`: Change handler
- \`size\`: Dialog size ('sm' | 'md' | 'lg' | 'full')
- \`centerText\`: Whether to center text
- \`loading\`: Whether to show loading state
- \`className\`: Additional CSS classes

## Customization
- Custom animations
- Custom triggers
- Custom content styling
- Icon customization
- Spacing adjustments
- Border styles
- Background colors
- Typography
`,
      },
    },
  },
  argTypes: {
    open: {
      description: 'The controlled open state of the dialog',
      control: 'boolean',
    },
    defaultOpen: {
      description: 'The default open state when uncontrolled',
      control: 'boolean',
    },
    onOpenChange: {
      description: 'Callback when the open state changes',
      control: 'function',
    },
    size: {
      description: 'The size of the dialog',
      control: 'select',
      options: ['sm', 'md', 'lg', 'full'],
    },
    centerText: {
      description: 'Whether to center text in the dialog',
      control: 'boolean',
    },
    loading: {
      description: 'Whether to show loading state',
      control: 'boolean',
    },
    className: {
      description: 'Additional CSS classes to apply to the dialog',
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const DialogDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Make changes to your profile here. Click save when you're done.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="name" className="text-right text-sm font-medium">
              Name
            </label>
            <div className="col-span-3">
              <Input id="name" placeholder="Enter your name" />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="username" className="text-right text-sm font-medium">
              Username
            </label>
            <div className="col-span-3">
              <Input id="username" placeholder="Enter username" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const Default: Story = {
  render: () => <DialogDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Basic dialog with a form for editing a profile.',
      },
    },
  },
};

const LoadingDialogDemo = () => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = () => {
    setIsLoading(true);
    // Simulate async operation
    setTimeout(() => {
      setIsLoading(false);
      setOpen(false);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Open Loading Dialog</Button>
      </DialogTrigger>
      <DialogContent loading={isLoading}>
        <DialogHeader>
          <DialogTitle>Processing Request</DialogTitle>
          <DialogDescription>Please wait while we process your request.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const WithLoading: Story = {
  render: () => <LoadingDialogDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Dialog with loading state for asynchronous operations.',
      },
    },
  },
};

const LargeDialogDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Open Large Dialog</Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Large Dialog Example</DialogTitle>
          <DialogDescription>This is an example of a large dialog with more content space.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Content Area</label>
            <Textarea className="h-40" placeholder="Enter detailed content here..." />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const Large: Story = {
  render: () => <LargeDialogDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Large dialog with more content space for detailed forms or information.',
      },
    },
  },
};

const FullScreenDialogDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Open Full Screen Dialog</Button>
      </DialogTrigger>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>Full Screen Dialog</DialogTitle>
          <DialogDescription>This dialog takes up most of the viewport space.</DialogDescription>
        </DialogHeader>
        <div className="flex-1">
          <div className="h-full rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-800">
            <div className="flex h-full items-center justify-center">Content Area</div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const FullScreen: Story = {
  render: () => <FullScreenDialogDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Full screen dialog that takes up most of the viewport space.',
      },
    },
  },
};
