import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

const subscribe = (callback: () => void) => {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
};

const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT;

// Matches the pre-hydration client value, where the viewport is not yet known.
const getServerSnapshot = () => false;

/**
 * Hook to check if the screen is mobile
 * @returns true if the screen is mobile, false otherwise
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
