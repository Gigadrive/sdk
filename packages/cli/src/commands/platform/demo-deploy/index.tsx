import { StatusMessage, UnorderedList } from '@inkjs/ui';
import type { Command } from 'commander';
import { Box, render, Text } from 'ink';

export const deploy = (parent: Command) => {
  parent
    .command('demo-deploy')
    .description('Deploy the current project')
    .action(async () => {
      render(
        <Box flexDirection="column" padding={1}>
          <Box>
            <StatusMessage variant="success">
              Deployed to{' '}
              <Text color={'green'} bold underline>
                https://demo-app.gigadrive.app
              </Text>
            </StatusMessage>
          </Box>

          <Box marginTop={1}>
            <UnorderedList>
              <UnorderedList.Item>
                <Box gap={1}>
                  <Text>Serverless Functions</Text>
                  <Text dimColor>x3</Text>
                </Box>
              </UnorderedList.Item>

              <UnorderedList.Item>
                <Box gap={1}>
                  <Text>Assets</Text>
                  <Text dimColor>x8</Text>
                </Box>
              </UnorderedList.Item>

              <UnorderedList.Item>
                <Box gap={1}>
                  <Text>Redirects</Text>
                  <Text dimColor>x1</Text>
                </Box>
              </UnorderedList.Item>
            </UnorderedList>
          </Box>
        </Box>
      );
    });
};
