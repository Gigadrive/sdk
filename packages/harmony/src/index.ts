import '@fontsource/manrope';
import './index.css';

export * from './hooks';
export * from './lib';

export function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export interface GenericProps {
  children?: React.ReactNode;
}
