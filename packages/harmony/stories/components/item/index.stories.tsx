import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Components/Item',
  component: Item,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A flexible container to display media, title, description, and actions. Group multiple items using ItemGroup and separate them with ItemSeparator.',
      },
    },
  },
  argTypes: {
    variant: {
      description: 'Visual style of the item',
      control: 'radio',
      options: ['default', 'outline', 'muted'],
      table: { defaultValue: { summary: 'default' } },
    },
    size: {
      description: 'Item spacing and density',
      control: 'radio',
      options: ['default', 'sm'],
      table: { defaultValue: { summary: 'default' } },
    },
    asChild: {
      description: 'Render the item as a child component (e.g., anchor)',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    className: { control: 'text' },
  },
  args: {
    variant: 'default',
    size: 'default',
  },
} satisfies Meta<typeof Item>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    children: (
      <>
        <ItemContent>
          <ItemTitle>Basic Item</ItemTitle>
          <ItemDescription>A simple item with title and description.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Action
          </Button>
        </ItemActions>
      </>
    ),
  },
  parameters: {
    docs: {
      description: { story: 'Basic usage with content and an action.' },
    },
  },
};

export const Variants: Story = {
  render: (args) => (
    <div className="flex w-full max-w-md flex-col gap-4">
      <Item {...args} variant="default">
        <ItemContent>
          <ItemTitle>Default Variant</ItemTitle>
          <ItemDescription>Subtle background and borders.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </ItemActions>
      </Item>
      <Item {...args} variant="outline">
        <ItemContent>
          <ItemTitle>Outline Variant</ItemTitle>
          <ItemDescription>Outlined style with transparent background.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </ItemActions>
      </Item>
      <Item {...args} variant="muted">
        <ItemContent>
          <ItemTitle>Muted Variant</ItemTitle>
          <ItemDescription>Subdued appearance for secondary content.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </ItemActions>
      </Item>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Showcases the available visual variants.' } },
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex w-full max-w-md flex-col gap-4">
      <Item {...args} size="default" variant="outline">
        <ItemContent>
          <ItemTitle>Default Size</ItemTitle>
          <ItemDescription>Standard spacing for general use.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Action
          </Button>
        </ItemActions>
      </Item>
      <Item {...args} size="sm" variant="outline">
        <ItemContent>
          <ItemTitle>Small Size</ItemTitle>
          <ItemDescription>Compact spacing for dense layouts.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Action
          </Button>
        </ItemActions>
      </Item>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Default and small sizes.' } },
  },
};

export const MediaIcon: Story = {
  args: {
    variant: 'outline',
    children: (
      <>
        <ItemMedia variant="icon">
          {/* Minimal inline icon to avoid external deps in story */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Security Alert</ItemTitle>
          <ItemDescription>New login detected from unknown device.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="sm" variant="outline">
            Review
          </Button>
        </ItemActions>
      </>
    ),
  },
  parameters: {
    docs: { description: { story: 'Using ItemMedia with the icon variant.' } },
  },
};

export const MediaImage: Story = {
  args: {
    variant: 'outline',
    children: (
      <>
        <ItemMedia variant="image">
          <img src="https://picsum.photos/seed/item/80/80" alt="Random" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Image Media</ItemTitle>
          <ItemDescription>Display an image or avatar as media.</ItemDescription>
        </ItemContent>
      </>
    ),
  },
  parameters: {
    docs: { description: { story: 'Using ItemMedia with the image variant.' } },
  },
};

export const GroupAndSeparator: Story = {
  render: (args) => (
    <ItemGroup className="w-full max-w-md">
      <Item {...args} variant="outline">
        <ItemContent>
          <ItemTitle>First Item</ItemTitle>
          <ItemDescription>Grouped items share consistent styling.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            Action
          </Button>
        </ItemActions>
      </Item>
      <ItemSeparator />
      <Item {...args}>
        <ItemContent>
          <ItemTitle>Second Item</ItemTitle>
          <ItemDescription>Separated by ItemSeparator inside ItemGroup.</ItemDescription>
        </ItemContent>
      </Item>
    </ItemGroup>
  ),
  parameters: {
    docs: { description: { story: 'Grouping multiple items with a separator.' } },
  },
};

export const HeaderAndFooter: Story = {
  args: {
    variant: 'outline',
    children: (
      <>
        <ItemHeader>
          <span className="text-xs text-muted-foreground">Item Header</span>
          <span className="text-xs">Meta</span>
        </ItemHeader>
        <ItemContent>
          <ItemTitle>Item Title</ItemTitle>
          <ItemDescription>Item description content goes here.</ItemDescription>
        </ItemContent>
        <ItemFooter>
          <span className="text-xs text-muted-foreground">Footer note</span>
          <Button size="sm" variant="outline">
            Action
          </Button>
        </ItemFooter>
      </>
    ),
  },
  parameters: {
    docs: { description: { story: 'Using ItemHeader and ItemFooter within an item.' } },
  },
};

export const AsLink: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <Item {...args} asChild>
        <a href="#">
          <ItemMedia />
          <ItemContent>
            <ItemTitle>Visit our documentation</ItemTitle>
            <ItemDescription>Learn how to get started with our components.</ItemDescription>
          </ItemContent>
          <ItemActions>
            {/* Simple chevron to avoid external icon deps */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </ItemActions>
        </a>
      </Item>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Render as a link using the asChild prop.' } },
  },
};
