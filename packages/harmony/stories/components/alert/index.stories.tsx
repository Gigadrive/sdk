import type { Meta, StoryObj } from '@storybook/react';
import { AlertCircle, CheckCircle, Info, Terminal, XCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const meta = {
  title: 'Components/Alert',
  component: Alert,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A versatile alert component that provides contextual feedback messages for user actions with support for multiple variants and customization options.

## Features
- Multiple visual variants (default, destructive, success, warning, error, info)
- Support for icons
- Title and description components
- Accessible by default with proper ARIA roles
- Dark mode support
- Customizable via className prop

## Accessibility
- Uses role="alert" for screen readers
- Proper color contrast in all variants
- Semantic HTML structure with AlertTitle and AlertDescription
- Dark mode support ensures readability in all themes

## Usage Guidelines
- Use default variant for neutral information
- Use destructive variant for critical warnings or errors that require immediate attention
- Use success variant for positive feedback
- Use warning variant for cautionary messages
- Use error variant for error states
- Use info variant for informational messages
- Add icons to enhance visual comprehension
- Use AlertTitle for clear, concise headings
- Use AlertDescription for detailed explanations

## Best Practices
- Keep alert messages clear and concise
- Use appropriate variant for the context
- Include actionable information when relevant
- Group related alerts together
- Consider using icons to enhance visual hierarchy
- Ensure sufficient contrast in both light and dark modes
`,
      },
    },
  },
  argTypes: {
    variant: {
      description: 'The visual style variant of the alert',
      control: 'select',
      options: ['default', 'destructive', 'success', 'warning', 'error', 'info'],
      table: {
        defaultValue: { summary: 'default' },
      },
    },
    className: {
      description: 'Additional CSS classes to apply to the alert',
      control: 'text',
    },
    children: {
      description: 'The content to display inside the alert',
      control: 'text',
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'This is a default alert',
  },
  parameters: {
    docs: {
      description: {
        story: 'The default alert style, used for neutral information.',
      },
    },
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'This is a destructive alert',
  },
  parameters: {
    docs: {
      description: {
        story: 'Destructive variant, used for critical warnings or errors that require immediate attention.',
      },
    },
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    children: 'This is a success alert',
  },
  parameters: {
    docs: {
      description: {
        story: 'Success variant, used for positive feedback and successful operations.',
      },
    },
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: 'This is a warning alert',
  },
  parameters: {
    docs: {
      description: {
        story: 'Warning variant, used for cautionary messages that require user attention.',
      },
    },
  },
};

export const Error: Story = {
  args: {
    variant: 'error',
    children: 'This is an error alert',
  },
  parameters: {
    docs: {
      description: {
        story: 'Error variant, used for error states and failed operations.',
      },
    },
  },
};

export const InfoAlert: Story = {
  args: {
    variant: 'info',
    children: 'This is an info alert',
  },
  parameters: {
    docs: {
      description: {
        story: 'Info variant, used for general informational messages.',
      },
    },
  },
};

export const WithTitle: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Alert Title</AlertTitle>
      <AlertDescription>This is an alert with a title and description.</AlertDescription>
    </Alert>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of using AlertTitle and AlertDescription components for structured content.',
      },
    },
  },
};

export const WithIcon: Story = {
  render: () => (
    <Alert>
      <Terminal className="h-4 w-4" />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>You can add components to your app using the cli.</AlertDescription>
    </Alert>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of adding an icon to the alert for enhanced visual hierarchy.',
      },
    },
  },
};

export const SuccessWithIcon: Story = {
  render: () => (
    <Alert variant="success">
      <CheckCircle className="h-4 w-4" />
      <AlertTitle>Success</AlertTitle>
      <AlertDescription>Your changes have been saved successfully.</AlertDescription>
    </Alert>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Success variant with an icon, title, and description - ideal for confirming successful operations.',
      },
    },
  },
};

export const WarningWithIcon: Story = {
  render: () => (
    <Alert variant="warning">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Warning</AlertTitle>
      <AlertDescription>Your account is about to expire. Please renew your subscription.</AlertDescription>
    </Alert>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Warning variant with an icon, showing how to display important notices that require user attention.',
      },
    },
  },
};

export const ErrorWithIcon: Story = {
  render: () => (
    <Alert variant="error">
      <XCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>There was a problem processing your request.</AlertDescription>
    </Alert>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Error variant with an icon, demonstrating how to show error states effectively.',
      },
    },
  },
};

export const InfoWithIcon: Story = {
  render: () => (
    <Alert variant="info">
      <Info className="h-4 w-4" />
      <AlertTitle>Information</AlertTitle>
      <AlertDescription>We've updated our privacy policy. Please review the changes.</AlertDescription>
    </Alert>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Info variant with an icon, perfect for general announcements and updates.',
      },
    },
  },
};

export const Destructive_WithIcon: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
    </Alert>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Destructive variant with an icon, used for critical system messages that require immediate action.',
      },
    },
  },
};
