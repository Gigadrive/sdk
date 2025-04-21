import { Button } from '@/components/ui/button';
import { ToastContextProvider, Toaster, useToast } from '@/components/ui/toast';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

const meta: Meta<typeof Toaster> = {
  title: 'Components/Toast',
  component: Toaster,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Toast component provides a way to display non-disruptive notifications to users. It's built on top of the Sonner library and supports various types of notifications with customizable content.

## Features
- Multiple toast types (success, error, info, warning)
- Auto-close functionality
- Custom content support
- Action buttons
- Cancel buttons
- Persistent toasts
- Theme support
- Accessibility features

## Props
- \`title\`: string - The title of the toast
- \`message\`: string - The message content
- \`type\`: 'success' | 'error' | 'info' | 'warning' - The type of toast
- \`autoClose\`: boolean - Whether to auto-close the toast
- \`action\`: ReactNode - Action button content
- \`cancel\`: ReactNode - Cancel button content
- \`onDismiss\`: () => void - Callback when toast is dismissed
- \`onAutoClose\`: () => void - Callback when toast auto-closes
- \`children\`: ReactNode - Custom content

## Accessibility
- WAI-ARIA compliant
- Keyboard navigation
- Focus management
- Screen reader support
- Proper ARIA attributes
- State announcements
- Color contrast

## Usage Guidelines
1. Use for non-disruptive notifications
2. Keep messages concise
3. Choose appropriate types
4. Consider auto-close timing
5. Add action buttons when needed
6. Test keyboard navigation
7. Ensure proper contrast
8. Handle edge cases

## Best Practices
- Limit toast duration
- Use clear messaging
- Maintain visual hierarchy
- Consider mobile usage
- Test across devices
- Ensure responsive behavior
- Follow design system
- Handle multiple toasts

## Customization
- Adjust colors
- Modify dimensions
- Change border radius
- Add custom styles
- Modify animations
- Adjust spacing
- Customize focus styles
- Change background
`,
      },
    },
  },
  decorators: [
    (Story) => (
      <ToastContextProvider>
        <Story />
      </ToastContextProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const ToastDemo = () => {
  const { addToast } = useToast();

  const showToast = () => {
    addToast({
      title: 'Default Toast',
      message: 'This is a default toast notification',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={showToast}>Show Toast</Button>
      <Toaster />
    </div>
  );
};

export const Default: Story = {
  render: () => <ToastDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A basic toast notification with a title and message. Demonstrates the default appearance and behavior of the toast component.',
      },
    },
  },
};

const ToastTypesDemo = () => {
  const { addToast } = useToast();

  const showSuccessToast = () => {
    addToast({
      title: 'Success',
      message: 'Operation completed successfully',
      type: 'success',
    });
  };

  const showErrorToast = () => {
    addToast({
      title: 'Error',
      message: 'Something went wrong',
      type: 'error',
    });
  };

  const showInfoToast = () => {
    addToast({
      title: 'Information',
      message: 'Here is some information for you',
      type: 'info',
    });
  };

  const showWarningToast = () => {
    addToast({
      title: 'Warning',
      message: 'Please be careful with this action',
      type: 'warning',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <Button onClick={showSuccessToast}>Success Toast</Button>
        <Button onClick={showErrorToast} variant="destructive">
          Error Toast
        </Button>
        <Button onClick={showInfoToast} variant="outline">
          Info Toast
        </Button>
        <Button onClick={showWarningToast} variant="secondary">
          Warning Toast
        </Button>
      </div>
      <Toaster />
    </div>
  );
};

export const ToastTypes: Story = {
  render: () => <ToastTypesDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Different types of toast notifications (success, error, info, warning). Shows how to use different toast types for various scenarios.',
      },
    },
  },
};

const AutoCloseToastDemo = () => {
  const { addToast } = useToast();

  const showAutoCloseToast = () => {
    addToast({
      title: 'Auto Close',
      message: 'This toast will close automatically',
      autoClose: true,
    });
  };

  const showPersistentToast = () => {
    addToast({
      title: 'Persistent',
      message: 'This toast will stay until dismissed',
      autoClose: false,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <Button onClick={showAutoCloseToast}>Auto Close Toast</Button>
        <Button onClick={showPersistentToast} variant="outline">
          Persistent Toast
        </Button>
      </div>
      <Toaster />
    </div>
  );
};

export const AutoCloseToast: Story = {
  render: () => <AutoCloseToastDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Toasts with different auto-close behaviors. Demonstrates how to create both auto-closing and persistent toasts.',
      },
    },
  },
};

const CustomToastDemo = () => {
  const { addToast } = useToast();

  const showCustomToast = () => {
    addToast({
      children: (
        <div className="p-2">
          <h3 className="font-bold">Custom Toast</h3>
          <p className="text-sm">This is a toast with custom content</p>
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="outline">
              Action
            </Button>
          </div>
        </div>
      ),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={showCustomToast}>Show Custom Toast</Button>
      <Toaster />
    </div>
  );
};

export const CustomToast: Story = {
  render: () => <CustomToastDemo />,
  parameters: {
    docs: {
      description: {
        story: 'A toast with custom content. Shows how to create a toast with custom layout and components.',
      },
    },
  },
};

const MultipleToastsDemo = () => {
  const { addToast } = useToast();
  const [count, setCount] = useState(0);

  const showMultipleToasts = () => {
    const newCount = count + 1;
    setCount(newCount);

    addToast({
      title: `Toast #${newCount}`,
      message: `This is toast number ${newCount}`,
      type: ['success', 'error', 'info', 'warning'][newCount % 4],
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={showMultipleToasts}>Add Another Toast</Button>
      <Toaster />
    </div>
  );
};

export const MultipleToasts: Story = {
  render: () => <MultipleToastsDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Multiple toasts with different types. Demonstrates how to handle multiple toasts and their stacking behavior.',
      },
    },
  },
};
