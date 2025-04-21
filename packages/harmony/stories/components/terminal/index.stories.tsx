import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Terminal, TerminalStep, TerminalTheme } from '@/components/ui/terminal';

const meta = {
  title: 'Components/Terminal',
  component: Terminal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Terminal component provides a customizable terminal emulator interface with typing animations and theme support. It's perfect for displaying command-line interactions, deployment logs, or any terminal-based content.

## Features
- Multiple theme support (macOS, Windows, Linux)
- Typing animation
- Customizable steps
- Theme switching
- Custom titles
- Color support
- Cursor animation
- Responsive design
- Dark mode support
- Accessibility features

## Props
- \`steps\`: TerminalStep[] - Array of terminal steps to display
- \`theme\`: TerminalTheme - Theme of the terminal ('macos' | 'windows' | 'linux')
- \`onThemeChange\`: (theme: TerminalTheme) => void - Theme change handler
- \`title\`: string - Title of the terminal window
- \`className\`: string - Additional CSS classes

## TerminalStep Interface
- \`text\`: string - Text to display
- \`delay\`: number - Delay between characters
- \`wait\`: number - Wait time after step completion
- \`color\`: string - Color of the text

## Accessibility
- ARIA roles and attributes
- Keyboard navigation
- Screen reader support
- Color contrast
- Focus management
- Semantic structure
- Reduced motion support
- Theme switching

## Usage Guidelines
1. Choose appropriate theme
2. Set reasonable typing speeds
3. Use meaningful titles
4. Consider content length
5. Test across devices
6. Ensure proper contrast
7. Support reduced motion
8. Follow design system

## Best Practices
- Keep content concise
- Use appropriate delays
- Choose readable colors
- Consider loading time
- Test across devices
- Follow design system
- Document custom styles
- Consider performance

## Customization
- Modify themes
- Adjust typing speed
- Change colors
- Customize prompts
- Adjust dimensions
- Modify animations
- Change transitions
- Customize styles
`,
      },
    },
  },
  argTypes: {
    steps: {
      description: 'Array of terminal steps to display',
    },
    theme: {
      description: 'Theme of the terminal',
    },
    onThemeChange: {
      description: 'Theme change handler',
    },
    title: {
      description: 'Title of the terminal window',
    },
    className: {
      description: 'Additional CSS classes',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Terminal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Terminal />,
  parameters: {
    docs: {
      description: {
        story: 'A basic terminal with default theme and steps. Demonstrates the core functionality of the component.',
      },
    },
  },
};

const ThemeSwitcherDemo = () => {
  const [theme, setTheme] = useState<TerminalTheme>('macos');

  return (
    <div className="space-y-4">
      <div className="flex justify-center space-x-4 mb-4">
        <Button variant={theme === 'macos' ? 'default' : 'outline'} onClick={() => setTheme('macos')}>
          macOS
        </Button>
        <Button variant={theme === 'windows' ? 'default' : 'outline'} onClick={() => setTheme('windows')}>
          Windows
        </Button>
        <Button variant={theme === 'linux' ? 'default' : 'outline'} onClick={() => setTheme('linux')}>
          Linux
        </Button>
      </div>
      <Terminal theme={theme} className="w-[640px]" title="Theme Switcher Demo" />
    </div>
  );
};

export const ThemeSwitcher: Story = {
  render: () => <ThemeSwitcherDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A terminal with theme switching functionality. Shows how to implement theme switching between macOS, Windows, and Linux themes.',
      },
    },
  },
};

const CustomStepsDemo = () => {
  const customSteps: TerminalStep[] = [
    { text: 'npm install next', delay: 100, wait: 500, color: 'white' },
    { text: '\nFetching packages...', delay: 30, wait: 800, color: 'gray' },
    {
      text: '\nResolving dependencies...',
      delay: 30,
      wait: 1000,
      color: 'blue',
    },
    { text: '\nAdding packages...', delay: 30, wait: 1200, color: 'gray' },
    { text: '\nInstalled packages:', delay: 30, wait: 500, color: 'white' },
    { text: '\n  - next@13.4.12', delay: 20, wait: 300, color: 'green' },
    { text: '\n  - react@18.2.0', delay: 20, wait: 300, color: 'green' },
    { text: '\n  - react-dom@18.2.0', delay: 20, wait: 300, color: 'green' },
    { text: '\n  - typescript@5.1.6', delay: 20, wait: 300, color: 'green' },
    { text: '\n\nDone in 3.2s', delay: 30, wait: 0, color: 'cyan' },
  ];

  return <Terminal steps={customSteps} className="w-[500px]" />;
};

export const CustomSteps: Story = {
  render: () => <CustomStepsDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A terminal with custom steps. Demonstrates how to create a sequence of terminal commands with different colors and timing.',
      },
    },
  },
};

const SlowTypingDemo = () => {
  const slowSteps: TerminalStep[] = [
    { text: 'echo "Hello, world!"', delay: 200, wait: 1000, color: 'white' },
    { text: '\nHello, world!', delay: 200, wait: 1000, color: 'green' },
    {
      text: '\n\necho "This is a slow typing demo"',
      delay: 200,
      wait: 1000,
      color: 'white',
    },
    {
      text: '\nThis is a slow typing demo',
      delay: 200,
      wait: 1000,
      color: 'green',
    },
  ];

  return <Terminal steps={slowSteps} className="w-[500px]" />;
};

export const SlowTyping: Story = {
  render: () => <SlowTypingDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A terminal with slow typing animation. Shows how to create a more deliberate typing effect with longer delays.',
      },
    },
  },
};

const FastTypingDemo = () => {
  const fastSteps: TerminalStep[] = [
    { text: 'ls -la', delay: 50, wait: 300, color: 'white' },
    {
      text: '\ntotal 42\ndrwxr-xr-x  23 user  staff   736B Jan 10 09:23 .\ndrwxr-xr-x   5 user  staff   160B Jan 10 09:23 ..\n-rw-r--r--   1 user  staff   2.1K Jan 10 09:23 .eslintrc.json\n-rw-r--r--   1 user  staff   1.2K Jan 10 09:23 .gitignore\n-rw-r--r--   1 user  staff   189B Jan 10 09:23 README.md\n-rw-r--r--   1 user  staff   2.3K Jan 10 09:23 next.config.js\n-rw-r--r--   1 user  staff    85K Jan 10 09:23 package-lock.json\n-rw-r--r--   1 user  staff   1.1K Jan 10 09:23 package.json\ndrwxr-xr-x  10 user  staff   320B Jan 10 09:23 public\ndrwxr-xr-x  15 user  staff   480B Jan 10 09:23 src',
      delay: 5,
      wait: 500,
      color: 'blue',
    },
    { text: '\n\ncd src', delay: 50, wait: 300, color: 'white' },
    { text: '\n\nls -la', delay: 50, wait: 300, color: 'white' },
    {
      text: '\ntotal 24\ndrwxr-xr-x  15 user  staff   480B Jan 10 09:23 .\ndrwxr-xr-x  23 user  staff   736B Jan 10 09:23 ..\ndrwxr-xr-x   8 user  staff   256B Jan 10 09:23 app\ndrwxr-xr-x   5 user  staff   160B Jan 10 09:23 components\ndrwxr-xr-x   3 user  staff    96B Jan 10 09:23 lib\ndrwxr-xr-x   4 user  staff   128B Jan 10 09:23 stories',
      delay: 5,
      wait: 0,
      color: 'blue',
    },
  ];

  return <Terminal steps={fastSteps} className="w-[500px]" />;
};

export const FastTyping: Story = {
  render: () => <FastTypingDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'A terminal with fast typing animation. Demonstrates how to create a quick typing effect with minimal delays.',
      },
    },
  },
};

export const CustomTitle: Story = {
  render: () => (
    <Terminal
      title="npm install"
      steps={[
        { text: 'npm install react', delay: 100, wait: 500, color: 'white' },
        { text: '\nInstalling...', delay: 30, wait: 800, color: 'gray' },
      ]}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'A terminal with a custom title. Shows how to customize the terminal window title.',
      },
    },
  },
};
