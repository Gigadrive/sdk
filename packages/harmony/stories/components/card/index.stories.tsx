import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A versatile card component that serves as a container for related content and actions.

## Features
- Composable architecture with multiple subcomponents
- Flexible layout options
- Support for various content types
- Customizable styling
- Dark mode support
- Interactive states
- Responsive design
- Accessible structure

## Subcomponents
- \`Card\`: The root container component
- \`CardHeader\`: Container for card title and description
- \`CardTitle\`: Main heading of the card
- \`CardDescription\`: Secondary text below the title
- \`CardContent\`: Main content area
- \`CardFooter\`: Container for actions and secondary content

## Usage Guidelines
- Use cards to group related information
- Use cards for content that needs visual separation
- Use cards in grid layouts for consistent presentation
- Use cards for interactive elements
- Consider content hierarchy within cards
- Maintain consistent spacing
- Use appropriate content density

## Best Practices
- Keep content concise and focused
- Use clear visual hierarchy
- Include meaningful actions when needed
- Consider mobile responsiveness
- Use appropriate spacing
- Maintain consistent styling
- Don't overcrowd with content
- Use appropriate animations for interactive cards

## Accessibility
- Semantic HTML structure
- Proper heading hierarchy
- Keyboard navigation support
- Focus management
- Clear visual hierarchy
- Sufficient color contrast
- Interactive element labeling

## Customization
- Border styles
- Shadow effects
- Background colors
- Typography
- Spacing
- Layout variations
- Interactive states
- Media content
`,
      },
    },
  },
  argTypes: {
    className: {
      description: 'Additional CSS classes to apply to the card',
      control: 'text',
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card Content</p>
      </CardContent>
      <CardFooter>
        <p>Card Footer</p>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Basic card layout with all subcomponents: header, content, and footer.',
      },
    },
  },
};

export const WithContent: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Account Summary</CardTitle>
        <CardDescription>Overview of your account status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Balance</p>
            <p className="text-2xl font-semibold">$2,500.00</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Recent Activity</p>
            <ul className="text-sm space-y-1">
              <li className="flex justify-between">
                <span>Coffee Shop</span>
                <span className="text-destructive">-$4.50</span>
              </li>
              <li className="flex justify-between">
                <span>Salary Deposit</span>
                <span className="text-green-600">+$2,000.00</span>
              </li>
              <li className="flex justify-between">
                <span>Grocery Store</span>
                <span className="text-destructive">-$65.23</span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm">
          View All
        </Button>
        <Button size="sm">Add Funds</Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of a card with rich content, showing financial information and transactions.',
      },
    },
  },
};

export const Simple: Story = {
  render: () => (
    <Card className="w-[350px] p-6">
      <CardTitle>Simple Card</CardTitle>
      <p className="mt-4 text-gray-500 dark:text-gray-400">
        This is a simple card with minimal styling and no separate header, content, or footer components.
      </p>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Minimalist card design without using subcomponents, suitable for simple content.',
      },
    },
  },
};

export const WithImage: Story = {
  render: () => (
    <Card className="w-[350px] overflow-hidden">
      <div className="h-[200px] bg-gray-200 dark:bg-gray-800">
        <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
          Image Placeholder
        </div>
      </div>
      <CardHeader>
        <CardTitle>Card with Image</CardTitle>
        <CardDescription>This card has an image at the top</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cards can include various media types like images, videos, or interactive elements.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" className="w-full">
          View Details
        </Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Card with media content, demonstrating how to incorporate images or other media.',
      },
    },
  },
};

export const Horizontal: Story = {
  render: () => (
    <Card className="flex w-[600px] overflow-hidden">
      <div className="w-1/3 bg-gray-200 dark:bg-gray-800">
        <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">Image</div>
      </div>
      <div className="w-2/3">
        <CardHeader>
          <CardTitle>Horizontal Card</CardTitle>
          <CardDescription>A card with horizontal layout</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This card uses a horizontal layout with an image on the left and content on the right.
          </p>
        </CardContent>
        <CardFooter>
          <Button size="sm">Learn More</Button>
        </CardFooter>
      </div>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Horizontal card layout, useful for list views or when image and content should be side by side.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Card className="w-[250px] transition-all hover:shadow-lg cursor-pointer">
        <CardHeader>
          <CardTitle>Interactive</CardTitle>
          <CardDescription>Hover over me</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">This card has hover effects</p>
        </CardContent>
      </Card>

      <Card className="w-[250px] border-primary">
        <CardHeader>
          <CardTitle>Highlighted</CardTitle>
          <CardDescription>Primary border</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">This card has a colored border</p>
        </CardContent>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Interactive cards with hover effects and highlighted states.',
      },
    },
  },
};
