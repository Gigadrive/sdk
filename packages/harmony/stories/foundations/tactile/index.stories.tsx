import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Foundations/Tactile',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Tactile depth primitives from \`theme.css\` — four recipes plus an activation
variant of \`.raised\`. Depth is harmony's design language:
**raised things are glossy, sunken things are recessed.**

| Class | Use on |
|---|---|
| \`.card-tactile\` | Cards, dialogs, settings sections, floating toolbars |
| \`.well\` | Inputs, selects, segmented tracks, progress tracks |
| \`.raised\` | Small raised controls: segment thumbs, status chips, avatar fallbacks, tooltips |
| \`.raised-on-active\` | Same recipe, applied only while \`data-state="active"\` (Radix tabs/segments) |
| \`.fill-gloss\` | Progress-bar and meter fills (glossy brand green) |

Buttons keep their own inline gloss recipe (see Button).`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const PrimitivesPanel = ({ theme }: { theme: 'light' | 'dark' }) => (
  <div className={`${theme} bg-background p-8 text-foreground`}>
    <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{theme}</p>
    <div className="space-y-6">
      <div className="card-tactile rounded-xl border bg-card p-5">
        <div className="text-sm font-semibold">.card-tactile</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Raised surface — sheen, inset top highlight, layered soft shadow.
        </div>
      </div>

      <div className="well rounded-lg border border-input bg-background p-4">
        <div className="text-sm font-semibold">.well</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Recessed well — inner shadow, sits below the surface.
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="raised inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium">
          .raised
        </span>
        <span className="raised grid size-9 place-items-center rounded-lg border border-border bg-card text-xs font-semibold">
          Aa
        </span>
      </div>

      <div>
        <div className="mb-1.5 text-xs text-muted-foreground">.fill-gloss on a .well track</div>
        <div className="well h-2 w-full rounded-full bg-muted">
          <div className="fill-gloss h-2 rounded-full" style={{ width: '55%' }} />
        </div>
      </div>
    </div>
  </div>
);

export const Primitives: Story = {
  render: () => (
    <div className="grid min-h-screen grid-cols-2">
      <PrimitivesPanel theme="light" />
      <PrimitivesPanel theme="dark" />
    </div>
  ),
};
