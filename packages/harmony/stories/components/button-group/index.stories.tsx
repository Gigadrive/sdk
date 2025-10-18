import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from '@/components/ui/button-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const meta = {
  title: 'Components/Button Group',
  component: ButtonGroup,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A composable container to group buttons, text, separators, and select triggers with shared borders and rounded corners. Supports horizontal and vertical orientations.',
      },
    },
  },
  argTypes: {
    orientation: {
      description: 'Layout direction of the group',
      control: 'radio',
      options: ['horizontal', 'vertical'],
      table: {
        defaultValue: { summary: 'horizontal' },
      },
    },
    className: {
      description: 'Additional classes for the container',
      control: 'text',
    },
  },
  args: {
    orientation: 'horizontal',
  },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <Button variant="secondary">Left</Button>
        <Button variant="secondary">Middle</Button>
        <Button variant="secondary">Right</Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Basic horizontal grouping of buttons sharing borders and radii.',
      },
    },
  },
};

export const WithSeparator: Story = {
  args: {
    children: (
      <>
        <Button variant="secondary">Previous</Button>
        <ButtonGroupSeparator />
        <Button variant="secondary">Next</Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Insert a separator between grouped controls.',
      },
    },
  },
};

export const WithText: Story = {
  args: {
    children: (
      <>
        <ButtonGroupText>Actions</ButtonGroupText>
        <Button variant="secondary">Edit</Button>
        <Button variant="destructive">Delete</Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Combine contextual text with actions inside the same group.',
      },
    },
  },
};

export const WithSelect: Story = {
  args: {
    children: (
      <>
        <ButtonGroupText>Sort</ButtonGroupText>
        <Select defaultValue="newest">
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary">Apply</Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Showcases integration with Select. The group handles border radii when a select trigger is the last item.',
      },
    },
  },
};

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
    children: (
      <>
        <Button>Top</Button>
        <ButtonGroupSeparator orientation="horizontal" />
        <Button>Bottom</Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Vertical orientation with a horizontal separator between items.',
      },
    },
  },
};
