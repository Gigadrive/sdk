// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { LayeredSidebarLayer } from './layered-sidebar';
import { LayeredSidebarProvider, useLayeredSidebar } from './layered-sidebar';

afterEach(() => {
  cleanup();
});

const appLayer: LayeredSidebarLayer = {
  id: 'app',
  title: 'App',
  sections: [
    {
      id: 'app-main',
      title: 'App Main',
      items: [
        { id: 'deployments', title: 'Deployments', href: '/org/app/deployments' },
        {
          id: 'settings',
          title: 'Settings',
          href: '/org/app/settings',
          matchPaths: ['/org/app/settings/variables'],
        },
      ],
    },
  ],
};

const manualLayer: LayeredSidebarLayer = {
  id: 'manual',
  title: 'Manual',
  sections: [
    {
      id: 'manual-main',
      title: 'Manual Main',
      items: [{ id: 'manual-item', title: 'Manual Item', href: '/manual' }],
    },
  ],
};

const rootLayer: LayeredSidebarLayer = {
  id: 'root',
  title: 'Root',
  sections: [
    {
      id: 'root-main',
      title: 'Root Main',
      items: [
        { id: 'home', title: 'Home', href: '/org' },
        { id: 'app', title: 'App', layer: appLayer },
      ],
    },
  ],
};

function Consumer() {
  const { layerStack, currentLayer, isCollapsed, setIsCollapsed, pushLayer, popLayer, resetToRoot } =
    useLayeredSidebar();

  return (
    <div>
      <span data-testid="layer-stack">{layerStack.map((layer) => layer.id).join('>')}</span>
      <span data-testid="current-layer">{currentLayer.id}</span>
      <span data-testid="collapsed">{String(isCollapsed)}</span>
      <button type="button" onClick={() => pushLayer(manualLayer)}>
        push
      </button>
      <button type="button" onClick={popLayer}>
        pop
      </button>
      <button type="button" onClick={resetToRoot}>
        reset
      </button>
      <button type="button" onClick={() => setIsCollapsed(true)}>
        collapse
      </button>
    </div>
  );
}

describe('LayeredSidebarProvider', () => {
  it('throws when hook is used outside provider', () => {
    expect(() => render(<Consumer />)).toThrow('useLayeredSidebar must be used within a LayeredSidebarProvider');
  });

  it('derives active layer path from pathname and supports navigation actions', () => {
    render(
      <LayeredSidebarProvider rootLayer={rootLayer} pathname="/org/app/settings/variables">
        <Consumer />
      </LayeredSidebarProvider>
    );

    expect(screen.getByTestId('layer-stack').textContent).toBe('root>app');
    expect(screen.getByTestId('current-layer').textContent).toBe('app');
    expect(screen.getByTestId('collapsed').textContent).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'push' }));
    expect(screen.getByTestId('layer-stack').textContent).toBe('root>app>manual');

    fireEvent.click(screen.getByRole('button', { name: 'pop' }));
    expect(screen.getByTestId('layer-stack').textContent).toBe('root>app');

    fireEvent.click(screen.getByRole('button', { name: 'collapse' }));
    expect(screen.getByTestId('collapsed').textContent).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    expect(screen.getByTestId('layer-stack').textContent).toBe('root');
    expect(screen.getByTestId('current-layer').textContent).toBe('root');
  });

  it('updates active layer stack when pathname changes without reload', () => {
    const { rerender } = render(
      <LayeredSidebarProvider rootLayer={rootLayer} pathname="/org/app/deployments">
        <Consumer />
      </LayeredSidebarProvider>
    );

    expect(screen.getByTestId('layer-stack').textContent).toBe('root>app');
    expect(screen.getByTestId('current-layer').textContent).toBe('app');

    fireEvent.click(screen.getByRole('button', { name: 'push' }));
    expect(screen.getByTestId('layer-stack').textContent).toBe('root>app>manual');

    rerender(
      <LayeredSidebarProvider rootLayer={rootLayer} pathname="/org">
        <Consumer />
      </LayeredSidebarProvider>
    );

    expect(screen.getByTestId('layer-stack').textContent).toBe('root');
    expect(screen.getByTestId('current-layer').textContent).toBe('root');
  });

  it('respects defaultCollapsed when not nested in SidebarProvider', () => {
    render(
      <LayeredSidebarProvider rootLayer={rootLayer} pathname="/org" defaultCollapsed>
        <Consumer />
      </LayeredSidebarProvider>
    );

    expect(screen.getByTestId('collapsed').textContent).toBe('true');
  });
});
