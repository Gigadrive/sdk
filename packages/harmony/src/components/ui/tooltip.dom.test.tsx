// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('TooltipContent', () => {
  beforeEach(() => {
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  });

  afterEach(cleanup);

  it('portals the content to the document body instead of the trigger subtree', async () => {
    const { container, getByText } = render(
      <TooltipProvider delayDuration={0}>
        <div style={{ textAlign: 'right', overflow: 'hidden' }}>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Tooltip body</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );

    fireEvent.focus(getByText('Trigger'));

    const content = await waitFor(() => {
      const element = document.body.querySelector('[data-radix-popper-content-wrapper]');
      if (!element) throw new Error('Expected the tooltip content to open');
      return element;
    });

    expect(content.textContent).toContain('Tooltip body');
    // Portaled content must not live inside the trigger's ancestors, where it
    // would inherit text alignment and be clipped by overflow containers.
    expect(container.contains(content)).toBe(false);
  });
});
