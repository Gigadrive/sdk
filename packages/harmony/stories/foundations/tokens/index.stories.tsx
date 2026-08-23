import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

const meta = {
  title: 'Foundations/Tokens',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Tactile theme token set. Every color is a CSS custom property in `theme.css`, consumed through Tailwind as `bg-<token>` / `text-<token>`. Semantic status tokens (`success`, `warning`, `danger`, `info`) each ship a `-soft` companion for tinted surfaces.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const SURFACE_TOKENS = ['background', 'card', 'popover', 'muted', 'secondary', 'accent', 'sidebar'] as const;
const CONTENT_TOKENS = ['foreground', 'muted-foreground', 'primary', 'destructive', 'border', 'input', 'ring'] as const;
const SEMANTIC_TOKENS = ['success', 'warning', 'danger', 'info'] as const;
const CHART_TOKENS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;

const Swatch = ({ token, soft = false }: { token: string; soft?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <div
      className="size-9 shrink-0 rounded-md border border-border"
      style={{ backgroundColor: `hsl(var(--${token}${soft ? '-soft' : ''}))` }}
    />
    <div className="min-w-0">
      <div className="truncate font-mono text-[11px] text-foreground">
        --{token}
        {soft ? '-soft' : ''}
      </div>
    </div>
  </div>
);

const TokenPanel = ({ theme }: { theme: 'light' | 'dark' }) => (
  <div className={`${theme} bg-background p-8 text-foreground`}>
    <p className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">{theme}</p>
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-sm font-medium">Surfaces</h3>
        <div className="grid grid-cols-2 gap-3">
          {SURFACE_TOKENS.map((t) => (
            <Swatch key={t} token={t} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium">Content &amp; chrome</h3>
        <div className="grid grid-cols-2 gap-3">
          {CONTENT_TOKENS.map((t) => (
            <Swatch key={t} token={t} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium">Semantic status (+ soft)</h3>
        <div className="grid grid-cols-2 gap-3">
          {SEMANTIC_TOKENS.map((t) => (
            <React.Fragment key={t}>
              <Swatch token={t} />
              <Swatch token={t} soft />
            </React.Fragment>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium">Charts</h3>
        <div className="grid grid-cols-2 gap-3">
          {CHART_TOKENS.map((t) => (
            <Swatch key={t} token={t} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const AllTokens: Story = {
  render: () => (
    <div className="grid min-h-screen grid-cols-2">
      <TokenPanel theme="light" />
      <TokenPanel theme="dark" />
    </div>
  ),
};
