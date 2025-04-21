import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const meta: Meta<typeof AlertDialog> = {
  title: 'Components/AlertDialog',
  component: AlertDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
### Alert Dialog Component

A modal dialog that interrupts the user's workflow to communicate important information and solicit a response. Built on top of Radix UI's AlertDialog primitive.

#### Features

- **Modal Behavior**: Blocks interaction with the rest of the application
- **Keyboard Navigation**: Full keyboard support for accessibility
- **Focus Management**: Automatically manages focus within the dialog
- **Multiple Sizes**: Supports different size variants (sm, md, lg, full)
- **Loading State**: Built-in support for loading states
- **Customizable Styling**: Flexible styling options through className props
- **Accessibility**: ARIA-compliant with proper roles and states

#### Best Practices

1. **Content Organization**
   - Keep titles clear and concise
   - Use description for detailed information
   - Place actions in the footer section
   - Maintain consistent spacing and alignment

2. **Visual Design**
   - Use clear visual hierarchy
   - Ensure sufficient contrast for readability
   - Maintain consistent styling with your application
   - Consider the impact of different size variants

3. **Interaction Design**
   - Provide clear action labels
   - Use appropriate button variants
   - Consider the flow of user interaction
   - Handle loading states appropriately

#### Usage Guidelines

1. **When to Use**
   - Critical confirmations
   - Important warnings
   - Destructive actions
   - Information that requires immediate attention
   - Actions that cannot be undone

2. **Implementation**
   - Import required components: \`AlertDialog\`, \`AlertDialogTrigger\`, \`AlertDialogContent\`, \`AlertDialogHeader\`, \`AlertDialogTitle\`, \`AlertDialogDescription\`, \`AlertDialogFooter\`, \`AlertDialogAction\`, \`AlertDialogCancel\`
   - Structure content appropriately
   - Handle open state and callbacks
   - Manage loading states when needed

3. **Customization**
   - Apply custom styles through className props
   - Modify size variants as needed
   - Adapt to your application's design system
   - Consider mobile responsiveness

#### Accessibility

- Ensure proper keyboard navigation
- Maintain focus management
- Provide clear ARIA labels
- Support screen readers
- Handle focus trapping appropriately`,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const AlertDialogDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger>Open Alert Dialog</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your account and remove your data from our
            servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A basic alert dialog with title, description, and action buttons.',
      },
    },
  },
  render: () => <AlertDialogDemo />,
};

const LoadingAlertDialogDemo = () => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = () => {
    setIsLoading(true);
    // Simulate async operation
    setTimeout(() => {
      setIsLoading(false);
      setOpen(false);
    }, 2000);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger>Open Loading Dialog</AlertDialogTrigger>
      <AlertDialogContent loading={isLoading}>
        <AlertDialogHeader>
          <AlertDialogTitle>Processing Request</AlertDialogTitle>
          <AlertDialogDescription>This action will process your request. Continue?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue} disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Continue'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const WithLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'An alert dialog demonstrating loading state handling during async operations.',
      },
    },
  },
  render: () => <LoadingAlertDialogDemo />,
};

const LargeAlertDialogDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger>Open Large Dialog</AlertDialogTrigger>
      <AlertDialogContent size="lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Large Dialog Example</AlertDialogTitle>
          <AlertDialogDescription>
            This is an example of a large dialog with more content space. It demonstrates the flexibility of the alert
            dialog component when dealing with larger content areas. You might use this for displaying more complex
            confirmations or information that requires more visual space.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const Large: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A large-sized alert dialog for content that requires more space.',
      },
    },
  },
  render: () => <LargeAlertDialogDemo />,
};

const CenteredTextAlertDialogDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger>Open Centered Text Dialog</AlertDialogTrigger>
      <AlertDialogContent centerText>
        <AlertDialogHeader>
          <AlertDialogTitle>Centered Text Example</AlertDialogTitle>
          <AlertDialogDescription>
            This dialog demonstrates centered text alignment. All content including the title, description and buttons
            will be centered.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const CenteredText: Story = {
  parameters: {
    docs: {
      description: {
        story: 'An alert dialog with centered text alignment for all content.',
      },
    },
  },
  render: () => <CenteredTextAlertDialogDemo />,
};

const FullScreenAlertDialogDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger>Open Full Screen Dialog</AlertDialogTrigger>
      <AlertDialogContent size="full">
        <AlertDialogHeader>
          <AlertDialogTitle>Full Screen Dialog</AlertDialogTitle>
          <AlertDialogDescription>
            This dialog takes up most of the viewport space, useful for displaying large amounts of content or complex
            interfaces that require more space.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex-1">
          <div className="h-full rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-800">
            <div className="flex h-full items-center justify-center">Content Area</div>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const FullScreen: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A full-screen alert dialog for content that requires maximum space.',
      },
    },
  },
  render: () => <FullScreenAlertDialogDemo />,
};

const MediumAlertDialogDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger>Open Medium Dialog</AlertDialogTrigger>
      <AlertDialogContent size="md">
        <AlertDialogHeader>
          <AlertDialogTitle>Medium Dialog Example</AlertDialogTitle>
          <AlertDialogDescription>
            This is a medium-sized dialog that provides a balanced amount of space for content. It's ideal for most
            common dialog use cases where you need more space than the default small size but don't need the expansive
            space of the large dialog.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const Medium: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A medium-sized alert dialog for balanced content space.',
      },
    },
  },
  render: () => <MediumAlertDialogDemo />,
};
