import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusBadge } from '@/components/ui/status-badge';

const meta = {
  title: 'Components/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
Status indicator with a colored dot — the shared replacement for ad-hoc status pills
(deployment states, request states, connection health, plan states).

- \`variant="chip"\` (default): raised bordered pill on a card surface
- \`variant="soft"\`: tinted pill for states that should stand out (e.g. Failed)
- \`variant="plain"\`: dot + label only, for dense table cells
- \`pulse\` animates the dot for in-progress states; \`glow\` adds a soft halo for live/healthy states.`,
      },
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['chip', 'soft', 'plain'] },
    tone: { control: 'select', options: ['success', 'warning', 'danger', 'info', 'neutral'] },
    pulse: { control: 'boolean' },
    glow: { control: 'boolean' },
    hideDot: { control: 'boolean' },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { tone: 'success', glow: true, children: 'Ready' },
};

export const DeploymentStates: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge tone="success" glow>
        Ready
      </StatusBadge>
      <StatusBadge tone="warning" pulse>
        Building
      </StatusBadge>
      <StatusBadge variant="soft" tone="danger">
        Failed
      </StatusBadge>
      <StatusBadge tone="neutral">Stopped</StatusBadge>
      <StatusBadge tone="info">Queued</StatusBadge>
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <StatusBadge tone="success">chip</StatusBadge>
        <StatusBadge variant="soft" tone="success">
          soft
        </StatusBadge>
        <StatusBadge variant="plain" tone="success">
          plain
        </StatusBadge>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge tone="danger">chip</StatusBadge>
        <StatusBadge variant="soft" tone="danger">
          soft
        </StatusBadge>
        <StatusBadge variant="plain" tone="danger">
          plain
        </StatusBadge>
      </div>
    </div>
  ),
};
