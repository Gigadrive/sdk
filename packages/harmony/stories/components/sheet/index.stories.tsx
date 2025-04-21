import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const meta: Meta<typeof Sheet> = {
  title: 'Components/Sheet',
  component: Sheet,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Sheet component is a versatile sliding panel that appears from the edge of the screen. It's built on top of Radix UI's Dialog primitive and provides a rich set of features for creating slide-out panels, sidebars, and bottom sheets.

## Features
- Multiple slide positions (top, right, bottom, left)
- Smooth animations
- Keyboard navigation
- Customizable styling
- Dark mode support
- Responsive design
- Type-safe props
- Accessible by default
- Form support
- Header and footer sections

## Subcomponents
- \`Sheet\`: The root container component
- \`SheetTrigger\`: The button that opens the sheet
- \`SheetContent\`: The main content container
- \`SheetHeader\`: Container for the header section
- \`SheetFooter\`: Container for the footer section
- \`SheetTitle\`: The title of the sheet
- \`SheetDescription\`: A description for the sheet
- \`SheetClose\`: A button to close the sheet

## Accessibility
- WAI-ARIA compliant
- Keyboard navigation support
- Screen reader friendly
- Focus management
- ARIA attributes
- Role attributes
- Proper heading structure
- Semantic HTML

## Usage Guidelines
1. Choose appropriate slide position
2. Use clear titles and descriptions
3. Maintain consistent styling
4. Consider mobile responsiveness
5. Test with screen readers
6. Ensure proper focus management
7. Use appropriate spacing
8. Keep content organized

## Best Practices
- Keep content focused
- Use consistent patterns
- Provide visual feedback
- Maintain visual hierarchy
- Use appropriate spacing
- Consider touch targets
- Test across devices
- Ensure responsive behavior

## Customization
- Adjust colors and themes
- Modify spacing and sizing
- Customize animations
- Change typography
- Add custom icons
- Modify transitions
- Adjust focus styles
- Customize hover states
`,
      },
    },
  },
  argTypes: {
    open: {
      description: 'Whether the sheet is open',
      control: 'boolean',
    },
    onOpenChange: {
      description: 'Callback when the open state changes',
    },
    className: {
      description: 'Additional CSS classes to apply to the sheet',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const SheetDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">Open Sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Profile</SheetTitle>
          <SheetDescription>Make changes to your profile here. Click save when you're done.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" className="col-span-3" placeholder="Enter your name" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username
            </Label>
            <Input id="username" className="col-span-3" placeholder="Enter username" />
          </div>
        </div>
        <SheetFooter>
          <Button type="submit">Save changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export const Default: Story = {
  render: () => <SheetDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A basic sheet with a form. Demonstrates common usage with header, content, and footer sections.',
      },
    },
  },
};

const LeftSheetDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">Open Left Sheet</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Left Side Sheet</SheetTitle>
          <SheetDescription>This sheet slides in from the left side of the screen.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Navigation</Label>
            <div className="flex flex-col space-y-2">
              {['Home', 'Profile', 'Settings', 'Help'].map((item) => (
                <Button key={item} variant="ghost" className="justify-start">
                  {item}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const LeftSide: Story = {
  render: () => <LeftSheetDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A sheet that slides in from the left side. Useful for navigation menus and sidebars.',
      },
    },
  },
};

const TopSheetDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">Open Top Sheet</Button>
      </SheetTrigger>
      <SheetContent side="top" className="h-1/3">
        <SheetHeader>
          <SheetTitle>Top Sheet</SheetTitle>
          <SheetDescription>This sheet slides down from the top of the screen.</SheetDescription>
        </SheetHeader>
        <div className="flex items-center justify-center h-full">
          <p className="text-center text-muted-foreground">
            Top sheets are useful for notifications and quick actions.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const TopSide: Story = {
  render: () => <TopSheetDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A sheet that slides down from the top. Perfect for notifications and quick actions.',
      },
    },
  },
};

const BottomSheetDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">Open Bottom Sheet</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-1/3">
        <SheetHeader>
          <SheetTitle>Bottom Sheet</SheetTitle>
          <SheetDescription>This sheet slides up from the bottom of the screen.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="flex justify-center space-x-2">
            <Button variant="outline">Cancel</Button>
            <Button>Confirm</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const BottomSide: Story = {
  render: () => <BottomSheetDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A sheet that slides up from the bottom. Ideal for mobile-friendly actions and confirmations.',
      },
    },
  },
};

const FormSheetDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">Open Form Sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create Account</SheetTitle>
          <SheetDescription>Fill in the form below to create a new account.</SheetDescription>
        </SheetHeader>
        <form className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="example@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input id="confirm-password" type="password" />
          </div>
        </form>
        <SheetFooter>
          <Button type="submit">Create Account</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export const FormSheet: Story = {
  render: () => <FormSheetDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A sheet containing a form. Shows how to create a modal form with proper layout and validation.',
      },
    },
  },
};
