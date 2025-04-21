import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/ui/button';
import { Password } from '@/components/ui/password';
import { useState } from 'react';

const meta = {
  title: 'Components/Password',
  component: Password,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Password component is a specialized input field for handling password input with enhanced security features and user experience. It extends the base Input component with password-specific functionality.

## Features
- Password visibility toggle
- Password strength meter
- Custom discouraged words
- Real-time strength feedback
- Accessibility support
- Dark mode support
- Responsive design
- Form integration
- Error handling
- Help text support

## Props
- \`showStrength\`: boolean - Whether to show the password strength meter
- \`discouragedWords\`: string[] - List of words to discourage in the password
- \`label\`: string - Label for the password field
- \`placeholder\`: string - Placeholder text
- \`error\`: string - Error message to display
- \`helpText\`: string - Helper text to display
- \`value\`: string - Controlled value
- \`onChange\`: (e: React.ChangeEvent<HTMLInputElement>) => void - Change handler
- \`className\`: string - Additional CSS classes

## Accessibility
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- Focus management
- Color contrast
- Error announcements
- Help text support

## Usage Guidelines
1. Always provide clear labels
2. Use strength meter for new passwords
3. Include help text for requirements
4. Handle errors appropriately
5. Consider mobile usage
6. Test across devices
7. Follow security best practices
8. Document password requirements

## Best Practices
- Use strength meter for new passwords
- Provide clear feedback
- Include password requirements
- Handle errors gracefully
- Consider mobile users
- Test across devices
- Follow security guidelines
- Document requirements

## Security Considerations
- Password visibility toggle
- Strength requirements
- Common password prevention
- Real-time feedback
- Secure input handling
- Error handling
- Form validation
- Data protection
`,
      },
    },
  },
  argTypes: {
    showStrength: {
      description: 'Whether to show the password strength meter',
    },
    discouragedWords: {
      description: 'List of words to discourage in the password',
    },
    label: {
      description: 'Label for the password field',
    },
    placeholder: {
      description: 'Placeholder text',
    },
    error: {
      description: 'Error message to display',
    },
    helpText: {
      description: 'Helper text to display',
    },
    value: {
      description: 'Controlled value',
    },
    onChange: {
      description: 'Change handler',
    },
    className: {
      description: 'Additional CSS classes',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Password>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter password',
  },
  parameters: {
    docs: {
      description: {
        story:
          'A basic password input with default styling and behavior. Demonstrates the core functionality of the component.',
      },
    },
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Password',
    placeholder: 'Enter your password',
  },
  parameters: {
    docs: {
      description: {
        story: 'A password input with a label. Shows how to add descriptive text to the password field.',
      },
    },
  },
};

export const WithStrengthMeter: Story = {
  args: {
    label: 'Password',
    placeholder: 'Enter password',
    showStrength: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'A password input with a strength meter. Demonstrates real-time password strength feedback.',
      },
    },
  },
};

export const WithHelpText: Story = {
  args: {
    label: 'Password',
    placeholder: 'Enter password',
    helpText: 'Password must be at least 8 characters long',
    showStrength: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'A password input with help text and strength meter. Shows how to provide additional guidance to users.',
      },
    },
  },
};

export const WithError: Story = {
  args: {
    label: 'Password',
    placeholder: 'Enter password',
    error: 'Password is required',
  },
  parameters: {
    docs: {
      description: {
        story: 'A password input with an error message. Demonstrates error state handling.',
      },
    },
  },
};

export const WithDiscouragedWords: Story = {
  args: {
    label: 'Password',
    placeholder: 'Enter password',
    showStrength: true,
    discouragedWords: ['password', 'admin', '123456'],
    helpText: 'Avoid using common words like "password", "admin", or "123456"',
  },
  parameters: {
    docs: {
      description: {
        story:
          'A password input with discouraged words and strength meter. Shows how to prevent common weak passwords.',
      },
    },
  },
};

const PasswordFormDemo = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
    } else {
      setError('');
      alert('Password submitted successfully!');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-80 space-y-4">
      <Password
        label="Create Password"
        placeholder="Enter password"
        showStrength={true}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Password
        label="Confirm Password"
        placeholder="Confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={error}
      />
      <Button type="submit" className="w-full">
        Submit
      </Button>
    </form>
  );
};

export const PasswordForm: Story = {
  render: () => <PasswordFormDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A complete password form with validation. Demonstrates how to use the Password component in a form context with password confirmation.',
      },
    },
  },
};
