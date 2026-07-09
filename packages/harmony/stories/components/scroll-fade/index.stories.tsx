import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * CSS-only scroll-edge fade utilities (shadcn `scroll-fade`), ported for Tailwind v3.
 *
 * Add `scroll-fade` / `scroll-fade-y` / `scroll-fade-x` (or edge variants) to the
 * element that actually scrolls (`overflow-*-auto`). Pair with `no-scrollbar` to
 * hide the scrollbar if desired.
 *
 * @see https://ui.shadcn.com/docs/utils/scroll-fade
 */
const meta = {
  title: 'Utilities/ScrollFade',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ItemList({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-1.5 p-1.5">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-lg bg-muted px-3 py-2.5 text-sm">
          Item {index + 1}
        </div>
      ))}
    </div>
  );
}

export const Vertical: Story = {
  render: () => (
    <div className="w-full max-w-xs overflow-hidden rounded-2xl border">
      <div className="scroll-fade h-72 overflow-y-auto">
        <ItemList count={12} />
      </div>
    </div>
  ),
};

export const NoOverflow: Story = {
  render: () => (
    <div className="w-full max-w-xs overflow-hidden rounded-2xl border">
      <div className="scroll-fade overflow-y-auto">
        <ItemList count={3} />
      </div>
    </div>
  ),
};

export const Horizontal: Story = {
  render: () => {
    const tags = [
      'Design',
      'Engineering',
      'Marketing',
      'Product',
      'Research',
      'Sales',
      'Support',
      'Operations',
      'Finance',
      'Legal',
    ];

    return (
      <div className="w-full max-w-xs overflow-hidden rounded-2xl border">
        <div className="scroll-fade-x overflow-x-auto">
          <div className="flex w-max gap-1.5 p-1.5">
            {tags.map((tag) => (
              <div key={tag} className="shrink-0 rounded-lg bg-muted px-3 py-2.5 text-sm">
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
};

export const BottomEdge: Story = {
  render: () => (
    <div className="w-full max-w-xs overflow-hidden rounded-2xl border">
      <div className="scroll-fade-b h-36 overflow-y-auto">
        <ItemList count={8} />
      </div>
    </div>
  ),
};

export const CustomSize: Story = {
  render: () => (
    <div className="flex w-full max-w-xs flex-col gap-6">
      <div className="overflow-hidden rounded-2xl border">
        <div className="scroll-fade scroll-fade-4 h-48 overflow-y-auto">
          <ItemList count={8} />
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border">
        <div className="scroll-fade scroll-fade-24 h-48 overflow-y-auto">
          <ItemList count={8} />
        </div>
      </div>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-full max-w-xs overflow-hidden rounded-2xl border">
      <div className="scroll-fade scroll-fade-none h-48 overflow-y-auto">
        <ItemList count={8} />
      </div>
    </div>
  ),
};
