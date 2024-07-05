import { Badge, Spinner } from '@inkjs/ui';
import { Box, render, Text } from 'ink';

let verbose: boolean = false;

export const setVerbose = (value: boolean) => {
  verbose = value;
};

export const isVerbose = () => verbose;

export const log = (message: any) => {
  render(<Text color={'grey'}>{message}</Text>);
};

export const error = (message: any) => {
  render(
    <Box gap={1}>
      <Badge color="red">Error</Badge>
      <Text color="red">{message}</Text>
    </Box>
  );
};

export const success = (message: any) => {
  render(
    <Box gap={1}>
      <Badge color="green">Success</Badge>
      <Text color="green">{message}</Text>
    </Box>
  );
};

export const warn = (message: any) => {
  render(
    <Box gap={1}>
      <Badge color="yellowBright">Warn</Badge>
      <Text color="yellowBright">{message}</Text>
    </Box>
  );
};

export const debug = (message?: any, ...optionalParams: any[]) => {
  if (!verbose) {
    return;
  }

  console.debug('[DEBUG]', message, ...optionalParams);
};

export const spinner = (message: any) => {
  render(<Spinner label={message} />);
};
