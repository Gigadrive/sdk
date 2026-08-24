import type { Meta, StoryObj } from '@storybook/react-vite';

import { Progress } from '@/components/ui/progress';

const meta = {
  title: 'Components/Progress',
  component: Progress,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Tactile progress bar: a recessed `.well` track with a glossy `.fill-gloss` fill. Use for usage meters, quotas and build progress.',
      },
    },
  },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100 } },
    tone: { control: 'select', options: ['primary', 'success', 'warning', 'danger'] },
    size: { control: 'select', options: ['sm', 'default', 'lg'] },
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 41, label: 'Compute usage' },
  render: (args) => (
    <div className="w-80">
      <Progress {...args} />
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="w-80 space-y-3">
      <Progress value={41} label="Primary" />
      <Progress value={72} tone="success" label="Success" />
      <Progress value={86} tone="warning" label="Warning" />
      <Progress value={97} tone="danger" label="Danger" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="w-80 space-y-3">
      <Progress value={41} size="sm" label="Small" />
      <Progress value={41} label="Default" />
      <Progress value={41} size="lg" label="Large" />
    </div>
  ),
};

export const UsageMeter: Story = {
  render: () => (
    <div className="w-80 space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Compute</span>
        <span className="tabular-nums">412.6 / 1,000 h</span>
      </div>
      <Progress value={41} label="Compute usage" />
    </div>
  ),
};
