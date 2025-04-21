import type { Meta, StoryObj } from '@storybook/react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A versatile avatar component built on top of Radix UI's Avatar primitive, providing a consistent way to represent users with images and fallback content.

## Features
- Image-based avatars with automatic fallback support
- Customizable sizes through className
- Fallback content for when images fail to load
- Accessible by default
- Customizable styling for both image and fallback states
- Support for avatar groups
- Dark mode compatible

## Accessibility
- Proper image alt text support
- Fallback text for screen readers
- Maintains aspect ratio for consistent display
- Proper ARIA attributes through Radix UI primitives

## Usage Guidelines
- Use for user profile pictures
- Use in user lists or mentions
- Use in chat interfaces
- Use in comment sections
- Use in navigation menus for user accounts

## Best Practices
- Always provide alt text for avatar images
- Keep fallback text short (1-2 characters)
- Use appropriate image sizes for performance
- Consider using initials for fallback content
- Group avatars when showing multiple users
- Maintain consistent sizing within contexts
- Use border colors to separate from background when needed

## Subcomponents
- \`Avatar\`: The root component
- \`AvatarImage\`: The image component
- \`AvatarFallback\`: The fallback component shown when image fails to load
`,
      },
    },
  },
  argTypes: {
    className: {
      description: 'Additional CSS classes to apply to the avatar',
      control: 'text',
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://github.com/Gigadrive.png" alt="@Gigadrive" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Default avatar with an image and fallback text.',
      },
    },
  },
};

export const WithFallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/broken-image.jpg" alt="@user" />
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Avatar with a broken image source, demonstrating the fallback behavior.',
      },
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar className="h-8 w-8">
        <AvatarImage src="https://github.com/Gigadrive.png" alt="@Gigadrive" />
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://github.com/Gigadrive.png" alt="@Gigadrive" />
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar className="h-12 w-12">
        <AvatarImage src="https://github.com/Gigadrive.png" alt="@Gigadrive" />
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different avatar sizes achieved through className customization.',
      },
    },
  },
};

export const CustomFallbackColors: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar>
        <AvatarFallback className="bg-primary text-primary-foreground">PR</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-secondary text-secondary-foreground">SC</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-destructive text-destructive-foreground">DE</AvatarFallback>
      </Avatar>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Customizing fallback colors using different background and text color combinations.',
      },
    },
  },
};

export const Group: Story = {
  render: () => (
    <div className="flex -space-x-4">
      <Avatar className="border-2 border-background">
        <AvatarImage src="https://github.com/Gigadrive.png" alt="@Gigadrive" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
      <Avatar className="border-2 border-background">
        <AvatarImage src="https://github.com/Zeryther.png" alt="@Zeryther" />
        <AvatarFallback>D3</AvatarFallback>
      </Avatar>
      <Avatar className="border-2 border-background">
        <AvatarFallback>+3</AvatarFallback>
      </Avatar>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Grouping multiple avatars with overlapping effect and remaining count indicator.',
      },
    },
  },
};
