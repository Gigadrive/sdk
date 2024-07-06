import { Spinner } from '@inkjs/ui';
import consola from 'consola';
import { render, Text } from 'ink';

let verbose: boolean = false;

export const setVerbose = (value: boolean) => {
  verbose = value;
};

export const isVerbose = () => verbose;

export const log = (message: any) => {
  render(<Text color={'grey'}>{message}</Text>);
};

export const error = (message: any) => {
  consola.error(message);
};

export const success = (message: any) => {
  consola.success(message);
};

export const warn = (message: any) => {
  consola.warn(message);
};

export const debug = (message?: any, ...optionalParams: any[]) => {
  if (!verbose) {
    return;
  }

  consola.debug('[DEBUG]', message, ...optionalParams);
};

export const spinner = (message: any) => {
  render(<Spinner label={message} />);
};
