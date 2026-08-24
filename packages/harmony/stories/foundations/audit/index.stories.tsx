import type { Meta, StoryObj } from '@storybook/react-vite';
import { Rocket } from 'lucide-react';
import * as React from 'react';

import { ActionPanel, ActionPanelBody, ActionPanelTitle } from '@/components/ui/action-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { SettingsCard, SettingsCardRow, SettingsCardStatus } from '@/components/ui/settings-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const meta = {
  title: 'Foundations/Audit',
  parameters: {
    layout: 'fullscreen',
    docs: { disable: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="mb-2 text-sm font-medium">{label}</div>
    {children}
  </div>
);

const AuditPanel = ({ theme }: { theme: 'light' | 'dark' }) => (
  <div className={`${theme} space-y-8 bg-background p-8 text-foreground`}>
    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Tactile · {theme}</p>

    <Section label="Buttons">
      <div className="flex flex-wrap items-center gap-3">
        <Button>Deploy project</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete</Button>
        <Button size="sm">Small</Button>
        <Button size="xs">Extra small</Button>
        <Button loading>Saving</Button>
      </div>
    </Section>

    <Section label="StatusBadge">
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
        <StatusBadge variant="plain" tone="success">
          Ready
        </StatusBadge>
        <StatusBadge variant="soft" tone="info" hideDot>
          Preview
        </StatusBadge>
      </div>
    </Section>

    <Section label="Badge">
      <div className="flex flex-wrap items-center gap-3">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="soft">Pro</Badge>
        <Badge variant="success">Paid</Badge>
        <Badge variant="warning">Trial</Badge>
        <Badge variant="danger">Overdue</Badge>
        <Badge variant="info">Beta</Badge>
      </div>
    </Section>

    <Section label="Tabs (segmented)">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
      </Tabs>
    </Section>

    <Section label="Form controls">
      <div className="max-w-sm space-y-4">
        <Input label="Project name" defaultValue="gigadrive-api" helpText="Used in your deployment URLs." />
        <Input label="Email" defaultValue="not-an-email" error="Please enter a valid email address." />
        <Field label="Field composite" htmlFor="audit-composed" hint="Field + plain Input.">
          <Input id="audit-composed" placeholder="Composed input" />
        </Field>
        <Textarea label="Description" placeholder="Something about this project…" />
        <div className="flex items-center gap-3">
          <Switch aria-label="Example switch, on" defaultChecked />
          <Switch aria-label="Example switch, off" />
          <span className="text-sm text-muted-foreground">Switch on / off</span>
        </div>
      </div>
    </Section>

    <Section label="Progress">
      <div className="max-w-sm space-y-3">
        <Progress value={41} />
        <Progress value={86} tone="warning" size="sm" />
        <Progress value={100} tone="success" />
      </div>
    </Section>

    <Section label="Alerts">
      <div className="max-w-xl space-y-3">
        <Alert variant="info">
          <Rocket />
          <AlertTitle>Scheduled maintenance</AlertTitle>
          <AlertDescription>The EU region will be under maintenance on Sunday at 02:00 UTC.</AlertDescription>
        </Alert>
        <Alert variant="success">
          <Rocket />
          <AlertTitle>Deployment successful</AlertTitle>
          <AlertDescription>Your project is live at gigadrive-api.gigadrive.app.</AlertDescription>
        </Alert>
      </div>
    </Section>

    <Section label="Card">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Usage this month</CardTitle>
          <CardDescription>Compute hours across all projects.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-medium tabular-nums tracking-tight">412.6 h</div>
          <Progress className="mt-3" value={41} />
        </CardContent>
      </Card>
    </Section>

    <Section label="SettingsCard">
      <SettingsCard
        className="max-w-xl"
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
          htmlFor="audit-app-name"
          description="The display name used across the console."
        >
          <Input id="audit-app-name" defaultValue="gigadrive-api" className="h-8" />
        </SettingsCardRow>
        <SettingsCardRow
          label="Always-warm residency"
          htmlFor="audit-warm"
          description="Keep at least one instance warm."
        >
          <Switch id="audit-warm" defaultChecked />
        </SettingsCardRow>
      </SettingsCard>
    </Section>

    <Section label="Table (compact)">
      <Card className="max-w-xl overflow-hidden">
        <Table density="compact">
          <TableHeader>
            <TableRow>
              <TableHead>Deployment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-[13px]">dpl_8f2ac91b</TableCell>
              <TableCell>
                <StatusBadge variant="plain" tone="success">
                  Ready
                </StatusBadge>
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">42 s</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-[13px]">dpl_c3d94a02</TableCell>
              <TableCell>
                <StatusBadge variant="soft" tone="danger">
                  Failed
                </StatusBadge>
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">1 m 12 s</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </Section>

    <Section label="ActionPanel + Avatar">
      <div className="flex max-w-xl items-start gap-4">
        <ActionPanel className="flex-1">
          <ActionPanelTitle>Delete application</ActionPanelTitle>
          <ActionPanelBody>Permanently remove this application and all deployments.</ActionPanelBody>
        </ActionPanel>
        <Avatar>
          <AvatarFallback>Jane Doe</AvatarFallback>
        </Avatar>
      </div>
    </Section>
  </div>
);

export const AllComponents: Story = {
  render: () => (
    <div className="grid grid-cols-2">
      <AuditPanel theme="light" />
      <AuditPanel theme="dark" />
    </div>
  ),
};
