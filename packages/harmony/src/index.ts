import '@fontsource/manrope';
import 'inter-ui/inter.css';
import './main.css';

export * from './components';
export * from './hooks';
export * from './lib';

export function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export interface GenericProps {
  children?: React.ReactNode;
}
