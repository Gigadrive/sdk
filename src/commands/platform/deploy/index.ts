import { createId } from '@paralleldrive/cuid2';
import { $ } from 'bun';
import type { Command } from 'commander';

export const deploy = (parent: Command) => {
  parent
    .command('deploy')
    .description('Deploy the current project')
    .action(async () => {
      const deploymentId = createId();

      await $`zip -r /tmp/project.zip . -x "node_modules/*" ".git/*" ".gitignore" "tmp/*"`;
      await $`aws s3 cp /tmp/project.zip s3://nebula-deployment-trigger-dev/deployments/${deploymentId}.zip`;

      console.log(`Deploying to https://${deploymentId}.gigadrivedev.com`);
    });
};
