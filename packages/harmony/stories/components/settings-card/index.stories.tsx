import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsCard, SettingsCardRow, SettingsCardStatus } from '@/components/ui/settings-card';
import { Switch } from '@/components/ui/switch';

const meta = {
  title: 'Components/SettingsCard',
  component: SettingsCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Settings section card with horizontal field rows and a status-aware footer save bar. The shared version of the console settings idiom.',
      },
    },
  },
} satisfies Meta<typeof SettingsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithFieldRows: Story = {
  args: { title: '' },
  render: () => (
    <SettingsCard
      className="w-[560px]"
      title="Application details"
      footer={
        <>
          <SettingsCardStatus state="unsaved" />
          <div className="flex gap-2">
            <Button variant="ghost" size="xs">
              Discard
            </Button>
            <Button size="xs">Save</Button>
          </div>
        </>
      }
    >
      <SettingsCardRow
        label="Application name"
        htmlFor="app-name"
        description="The display name used across the console."
      >
        <Input id="app-name" defaultValue="gigadrive-api" className="h-8" />
      </SettingsCardRow>
      <SettingsCardRow
        label="Always-warm residency"
        description="Keep at least one instance warm to avoid cold starts."
        htmlFor="always-warm"
      >
        <Switch id="always-warm" defaultChecked />
      </SettingsCardRow>
    </SettingsCard>
  ),
};

export const Saved: Story = {
  args: { title: '' },
  render: () => (
    <SettingsCard
      className="w-[560px]"
      title="Build"
      footer={
        <>
          <SettingsCardStatus state="saved">Saved 2 minutes ago</SettingsCardStatus>
          <Button size="xs" disabled>
            Save
          </Button>
        </>
      }
    >
      <SettingsCardRow label="Root directory" htmlFor="root-dir" description="Leave empty to use the repository root.">
        <Input id="root-dir" defaultValue="apps/api" className="h-8 font-mono text-xs" />
      </SettingsCardRow>
    </SettingsCard>
  ),
};

export const DangerZone: Story = {
  args: { title: '' },
  render: () => (
    <SettingsCard
      className="w-[560px]"
      danger
      title="Delete application"
      description="Permanently remove this application and all deployments. This cannot be undone."
      footer={
        <>
          <span />
          <Button variant="outline" size="xs" className="border-danger/40 text-danger hover:bg-danger-soft">
            Delete…
          </Button>
        </>
      }
    />
  ),
};
