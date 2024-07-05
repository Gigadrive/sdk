import { $, sleep } from 'bun';
import type { Command } from 'commander';
import fs from 'fs';
import { debug, isVerbose, spinner, success } from '../../../util/log';

export const deploy = (parent: Command) => {
  parent
    .command('deploy')
    .description('Deploy the current project')
    .action(async () => {
      const deploymentId = await createDeployment();

      debug(`Deployment ID: ${deploymentId}`);

      spinner('Uploading...');

      const uploadId = await startMultipartUpload(deploymentId);

      debug(`Upload ID: ${uploadId}`);

      const archivePath = '/tmp/project.zip';

      if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
      }

      await zipFolder(process.cwd(), archivePath, { verbose: isVerbose() });

      debug('Uploading archive...');

      const file = Bun.file(archivePath);
      const fileChunkSize = 10 * 1024 * 1024; // 10 MB
      const fileSize = file.size;
      const numChunks = Math.ceil(fileSize / fileChunkSize);
      const promises = [];
      let start, end, blob;

      for (let index = 1; index < numChunks + 1; index++) {
        start = (index - 1) * fileChunkSize;
        end = index * fileChunkSize;
        blob = index < numChunks ? file.slice(start, end) : file.slice(start);

        const presignedUrl = await getPresignedUrl(deploymentId, uploadId, index);
        debug('Presigned URL for part', index, presignedUrl);

        const promise = fetch(presignedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: blob,
        });

        promises.push(promise);
      }

      const finishedParts: { partNumber: number; etag: string }[] = [];

      (await Promise.all(promises)).forEach((res, index) => {
        if (!res.ok) {
          throw new Error(`Failed to upload part ${index + 1}: ${res.statusText}`);
        }

        finishedParts.push({
          partNumber: index + 1,
          etag: res.headers.get('ETag') as string,
        });
      });

      await completeUpload(deploymentId, uploadId, finishedParts);

      //await $`aws s3 cp /tmp/project.zip s3://nebula-deployment-trigger-dev/deployments/${deploymentId}.zip`;

      spinner('Building...');

      // TODO: Stream CI logs to the terminal

      await sleep(5000);

      success(`Deploying to https://${deploymentId}.gigadrivedev.com`);
    });
};

const createDeployment = async () => {
  const res = await fetch('http://localhost:3000/deployment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organizationId: '123',
      applicationId: '123',
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to create deployment: ' + (await res.text()));
  }

  const deployment = await res.json();

  return deployment.id as string;
};

const startMultipartUpload = async (deploymentId: string) => {
  const res = await fetch(`http://localhost:3000/deployment/${deploymentId}/pre-signed-url/start`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error('Failed to start multipart upload: ' + (await res.text()));
  }

  const upload = await res.json();

  return upload.uploadId as string;
};

const getPresignedUrl = async (deploymentId: string, uploadId: string, partNumber: number) => {
  const res = await fetch(
    `http://localhost:3000/deployment/${deploymentId}/pre-signed-url/part?uploadId=${uploadId}&partNumber=${partNumber}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    throw new Error('Failed to get pre-signed URL: ' + (await res.text()));
  }

  const upload = await res.json();

  return upload.url as string;
};

const completeUpload = async (
  deploymentId: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
) => {
  const res = await fetch(`http://localhost:3000/deployment/${deploymentId}/pre-signed-url/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uploadId,
      parts,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to complete upload: ' + (await res.text()));
  }
};

const zipFolder = async (
  folderPath: string,
  outPath: string,
  options: {
    verbose?: boolean;
  } = {
    verbose: false,
  }
): Promise<void> => {
  // delete file if it exists
  if (fs.existsSync(outPath)) {
    fs.unlinkSync(outPath);
  }

  const shell = $`cd ${folderPath}; zip -r9 ${outPath} *`;

  if (options.verbose) {
    await shell;
  } else {
    await shell.quiet();
  }

  // if file does not exist, throw error
  if (!fs.existsSync(outPath)) {
    throw new Error(`Failed to create zip file at ${outPath}`);
  }
};
