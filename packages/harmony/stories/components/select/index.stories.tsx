import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const meta = {
  title: 'Components/Select',
  component: SelectTrigger,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A select component built on Radix UI's Select primitive, following shadcn/ui patterns. Displays a
list of options for the user to pick one from, with full keyboard navigation and accessibility.

## Features
- Two trigger sizes (\`sm\`, \`default\`)
- Grouped options with labels and separators
- Selected-item check indicator
- Disabled items and disabled control
- Scroll up/down buttons for long lists
- \`item-aligned\` (default) and \`popper\` positioning

## Accessibility
- Follows the WAI-ARIA listbox pattern
- Full keyboard navigation (arrows, type-ahead, Home/End, Escape)
- Focus management and disabled-state handling

## Usage Guidelines
- Compose \`Select\` with \`SelectTrigger\`, \`SelectValue\`, \`SelectContent\`, and \`SelectItem\`
- Use \`SelectGroup\` + \`SelectLabel\` to organise related options
- Use \`SelectSeparator\` between groups
- Give the trigger an explicit width (e.g. \`className="w-[220px]"\`) for consistent layout
`,
      },
    },
  },
  argTypes: {
    size: {
      description: 'The size of the select trigger',
      control: 'select',
      options: ['sm', 'default'],
      table: {
        defaultValue: { summary: 'default' },
      },
    },
    disabled: {
      description: 'Whether the select trigger is disabled',
      control: 'boolean',
    },
  },
} satisfies Meta<typeof SelectTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select disabled={args.disabled}>
      <SelectTrigger className="w-[220px]" size={args.size}>
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="blueberry">Blueberry</SelectItem>
        <SelectItem value="grapes">Grapes</SelectItem>
        <SelectItem value="pineapple">Pineapple</SelectItem>
      </SelectContent>
    </Select>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The default select with a placeholder and a handful of options.',
      },
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Select>
        <SelectTrigger className="w-[180px]" size="sm">
          <SelectValue placeholder="Small" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="blueberry">Blueberry</SelectItem>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger className="w-[180px]" size="default">
          <SelectValue placeholder="Default" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="blueberry">Blueberry</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The `sm` and `default` trigger sizes side by side.',
      },
    },
  },
};

export const WithGroupsAndLabels: Story = {
  render: (args) => (
    <Select>
      <SelectTrigger className="w-[220px]" size={args.size}>
        <SelectValue placeholder="Select a food" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="blueberry">Blueberry</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Vegetables</SelectLabel>
          <SelectItem value="carrot">Carrot</SelectItem>
          <SelectItem value="potato">Potato</SelectItem>
          <SelectItem value="spinach">Spinach</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Options organised into groups with labels and a separator between them.',
      },
    },
  },
};

export const DisabledItems: Story = {
  render: (args) => (
    <Select>
      <SelectTrigger className="w-[220px]" size={args.size}>
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana" disabled>
          Banana (out of stock)
        </SelectItem>
        <SelectItem value="blueberry">Blueberry</SelectItem>
      </SelectContent>
    </Select>
  ),
  parameters: {
    docs: {
      description: {
        story: 'An individual option can be disabled and is skipped during keyboard navigation.',
      },
    },
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <Select disabled={args.disabled}>
      <SelectTrigger className="w-[220px]" size={args.size}>
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
      </SelectContent>
    </Select>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The entire control can be disabled via the `disabled` prop on `Select`.',
      },
    },
  },
};

export const Scrolling: Story = {
  render: (args) => (
    <Select>
      <SelectTrigger className="w-[220px]" size={args.size}>
        <SelectValue placeholder="Select a timezone" />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 30 }, (_, i) => (
          <SelectItem key={i} value={`utc-${i}`}>
            UTC+{i}:00
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A long list of options exercises the scroll up/down buttons.',
      },
    },
  },
};

export const Popper: Story = {
  render: (args) => (
    <Select>
      <SelectTrigger className="w-[220px]" size={args.size}>
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="blueberry">Blueberry</SelectItem>
      </SelectContent>
    </Select>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Using `position="popper"` anchors the content below the trigger instead of over it.',
      },
    },
  },
};
