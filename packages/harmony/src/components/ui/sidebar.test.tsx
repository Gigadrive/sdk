// @vitest-environment jsdom

import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Sidebar, SidebarContent, SidebarProvider, type SidebarNavLayer } from './sidebar';

function mockMatchMedia(matches = false): void {
  window.matchMedia = (query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

beforeEach(() => {
  mockMatchMedia(false);
});

afterEach(() => {
  cleanup();
});

const appLayer: SidebarNavLayer = {
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

const rootLayer: SidebarNavLayer = {
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

function renderDeclarative(pathname: string) {
  return render(
    <SidebarProvider>
      <Sidebar collapsible="none">
        <SidebarContent rootLayer={rootLayer} pathname={pathname} />
      </Sidebar>
    </SidebarProvider>
  );
}

/** Current (non-exiting) layer panel — AnimatePresence may leave an exiting sibling in the DOM. */
function currentLayerPanel() {
  const panels = document.querySelectorAll('[data-sidebar="content"] > div');
  return panels[panels.length - 1] as HTMLElement;
}

describe('SidebarContent declarative layers', () => {
  it('derives the active layer from pathname and shows a back control', () => {
    renderDeclarative('/org/app/settings/variables');

    const panel = currentLayerPanel();
    expect(within(panel).getByRole('button', { name: /App/ })).toBeTruthy();
    expect(within(panel).getByText('Deployments')).toBeTruthy();
    expect(within(panel).getByText('Settings')).toBeTruthy();
    expect(within(panel).queryByText('Home')).toBeNull();
  });

  it('updates the active layer when pathname changes', () => {
    const { rerender } = renderDeclarative('/org/app/deployments');
    expect(within(currentLayerPanel()).getByText('Deployments')).toBeTruthy();

    rerender(
      <SidebarProvider>
        <Sidebar collapsible="none">
          <SidebarContent rootLayer={rootLayer} pathname="/org" />
        </Sidebar>
      </SidebarProvider>
    );

    const panel = currentLayerPanel();
    expect(within(panel).getByText('Home')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'App' })).toBeTruthy();
    expect(within(panel).queryByText('Deployments')).toBeNull();
  });

  it('pushes a nested layer when a layer item is clicked', () => {
    renderDeclarative('/org');

    fireEvent.click(within(currentLayerPanel()).getByRole('button', { name: 'App' }));

    const panel = currentLayerPanel();
    expect(within(panel).getByText('Deployments')).toBeTruthy();
    expect(within(panel).getByText('Settings')).toBeTruthy();
    expect(within(panel).queryByText('Home')).toBeNull();
  });

  it('pops back to the parent layer', () => {
    renderDeclarative('/org/app/deployments');
    expect(within(currentLayerPanel()).getByText('Deployments')).toBeTruthy();

    fireEvent.click(within(currentLayerPanel()).getByRole('button', { name: /App/ }));

    const panel = currentLayerPanel();
    expect(within(panel).getByText('Home')).toBeTruthy();
  });

  it('renders root items when pathname matches the root layer', () => {
    renderDeclarative('/org');

    const panel = currentLayerPanel();
    expect(within(panel).getByText('Home')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'App' })).toBeTruthy();
  });
});
