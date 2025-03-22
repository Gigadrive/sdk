import { createConsola } from 'consola';

let verbose: boolean = false;

// Create a custom consola instance that can be updated with verbose settings
const consola = createConsola({
  level: verbose ? 4 : 3, // 4 includes debug messages, 3 is the default (info and above)
  formatOptions: {
    colors: true,
  },
});

// Update the consola instance when verbose setting changes
const updateConsola = () => {
  consola.level = verbose ? 4 : 3;
};

export const setVerbose = (value: boolean) => {
  verbose = value;
  updateConsola();
};

export const isVerbose = () => verbose;

export const log = (message: any) => {
  consola.info(message);
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
  //render(<Spinner label={message} />);
  log(message);
};
