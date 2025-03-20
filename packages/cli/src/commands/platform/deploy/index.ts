import { formatFileSize, objectToQueryString } from '@gigadrive/commons';
import type { NormalizedConfig } from '@gigadrive/network-config';
import { findConfig, parseConfig } from '@gigadrive/network-config';
import type { Command } from 'commander';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { debug, error, log, spinner, success, warn } from '../../../util/log';
import { createZipArchive } from '../../../util/zip';

export const deploy = (parent: Command) => {
  parent
    .command('deploy')
    .description('Deploy the current project')
    .action(async () => {
      debug('Starting deploy command');
      const configPath = findConfig(process.cwd());

      if (!configPath) {
        debug('No config file found');
        throw new Error('The current project folder does not have a valid config file.');
      }

      debug(`Found config at: ${configPath}`);
      const config = await parseConfig(configPath, process.cwd());
      debug('Parsed config', config);

      if (config.warnings.length > 0) {
        debug(`Found ${config.warnings.length} warnings in config`);
        config.warnings.forEach((message) => {
          warn(message);
        });
      }

      if (config.errors.length > 0) {
        debug(`Found ${config.errors.length} errors in config`);
        config.errors.forEach((message) => {
          error(message);
        });

        throw new Error('The current project folder does not have a valid config file.');
      }

      debug('Creating deployment');
      const deploymentId = await createDeployment({
        applicationId: 'test', // TODO
      });

      debug(`Deployment ID: ${deploymentId}`);

      debug('Starting deployment process');
      await handleDeployment(deploymentId, config);
    });
};

const handleDeployment = async (deploymentId: string, config: NormalizedConfig) => {
  debug('Deployment process initialized');
  let status: DeploymentStatus = 'PENDING';
  const logs: DeploymentLog[] = [];

  // Log deployment ID
  addLog('Deployment ID: ' + deploymentId, 'INFO', logs);

  // Start upload
  try {
    debug('Starting upload process');
    await uploadArchive(deploymentId, logs);
    debug('Upload completed successfully');
    addLog('Upload complete.', 'INFO', logs);
    addLog('The deployment pipeline is now being provisioned. This may take a few seconds.', 'INFO', logs);
  } catch (err) {
    debug(`Upload failed with error: ${(err as Error).message}`);
    addLog(`Upload failed: ${(err as Error).message}`, 'ERROR', logs);
    status = 'FAILED';
    error('The deployment failed. Please check the logs for more information.');
    return;
  }

  // Start status polling
  const statusInterval = setInterval(async () => {
    try {
      debug(`Fetching deployment status for ${deploymentId}`);
      const newStatus = await getDeploymentStatus(deploymentId);
      debug(`Current status: ${status}, New status: ${newStatus}`);

      if (newStatus === 'ACTIVE' || newStatus === 'FAILED') {
        debug(`Final status reached: ${newStatus}, clearing interval`);
        clearInterval(statusInterval);
        clearInterval(logsInterval);

        if (newStatus === 'ACTIVE') {
          success(`Deployed to https://${deploymentId}.gigadrivedev.com`);
        } else {
          error('The deployment failed. Please check the logs for more information.');
        }

        return;
      }

      if (newStatus !== status) {
        debug(`Updating status from ${status} to ${newStatus}`);
        status = newStatus;
        spinner(`Status: ${status.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}`);
      }
    } catch (err) {
      debug(`Error fetching status: ${(err as Error).message}`);
    }
  }, 1000);

  // Start logs polling
  const logsInterval = setInterval(async () => {
    try {
      debug(`Fetching logs for ${deploymentId}, current log count: ${logs.length}`);
      const newLogs = await getLogs(deploymentId, {
        offset: logs.length,
        limit: 100,
        'createdAt[gt]': logs[logs.length - 1]?.createdAt,
      });

      debug(`Fetched ${newLogs.items.length} new logs`);

      // Display new logs
      for (const logEntry of newLogs.items) {
        logs.push(logEntry);

        if (logEntry.type === 'ERROR') {
          error(logEntry.message);
        } else if (logEntry.type === 'WARN') {
          warn(logEntry.message);
        } else {
          log(logEntry.message);
        }
      }
    } catch (err) {
      debug(`Error fetching logs: ${(err as Error).message}`);
    }
  }, 1000);

  // Initial status display
  spinner(`Status: ${status.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}`);
};

const addLog = (message: string, type: 'INFO' | 'ERROR' | 'WARN', logs: DeploymentLog[]) => {
  debug(`Adding log: [${type}] ${message}`);
  logs.push({
    id: String(logs.length),
    message,
    type,
    createdAt: new Date().toISOString(),
  });

  if (type === 'ERROR') {
    error(message);
  } else if (type === 'WARN') {
    warn(message);
  } else {
    log(message);
  }
};

const uploadArchive = async (deploymentId: string, logs: DeploymentLog[]) => {
  debug('Starting uploadArchive');
  addLog('Creating archive...', 'INFO', logs);

  const archivePath = path.join(process.env.TEMP || os.tmpdir(), `project-${Date.now()}.zip`);
  debug(`Archive path: ${archivePath}`);

  if (fs.existsSync(archivePath)) {
    debug(`Archive already exists, removing: ${archivePath}`);
    fs.unlinkSync(archivePath);
  }

  debug('Creating zip archive');
  await createZipArchive(process.cwd(), archivePath, { useIgnoreFiles: false, useManagedIgnore: false });

  const fileStats = fs.statSync(archivePath);
  const fileSize = fileStats.size;
  debug(`Archive created, size: ${fileSize} bytes (${formatFileSize(fileSize)})`);

  addLog(`Archive created (${formatFileSize(fileSize)})`, 'INFO', logs);

  addLog('Uploading archive...', 'INFO', logs);

  debug(`Starting multipart upload for deployment: ${deploymentId}`);
  const uploadId = await startMultipartUpload(deploymentId);

  debug(`Upload ID: ${uploadId}`);

  debug('Uploading archive...');

  const fileChunkSize = 10 * 1024 * 1024; // 10 MB
  const numChunks = Math.ceil(fileSize / fileChunkSize);
  debug(`File size: ${fileSize}, chunk size: ${fileChunkSize}, number of chunks: ${numChunks}`);

  const promises = [];
  let start: number, end: number;

  for (let index = 1; index < numChunks + 1; index++) {
    start = (index - 1) * fileChunkSize;
    end = index * fileChunkSize;
    debug(`Processing chunk ${index}/${numChunks}, start: ${start}, end: ${end}`);

    const presignedUrl = await getPresignedUrl(deploymentId, uploadId, index);
    debug('Presigned URL for part', index, presignedUrl);

    const promise = new Promise<Response>(async (resolve, reject) => {
      try {
        debug(`Reading chunk ${index} data`);
        const readStream = fs.createReadStream(archivePath, {
          start,
          end: index < numChunks ? end - 1 : undefined,
        });

        const chunks: Buffer[] = [];
        readStream.on('data', (chunk: Buffer | string) => {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        });

        await new Promise<void>((resolveRead) => {
          readStream.on('end', () => resolveRead());
          readStream.on('error', reject);
        });

        const buffer = Buffer.concat(chunks);

        debug(`Uploading chunk ${index} to presigned URL (${buffer.length} bytes)`);
        const response = await fetch(presignedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/zip',
            'Content-Length': String(buffer.length),
          },
          body: buffer,
        });
        resolve(response);
      } catch (err) {
        reject(err);
      }
    });

    promises.push(promise);
  }

  const finishedParts: { partNumber: number; etag: string }[] = [];

  try {
    debug(`Waiting for all ${promises.length} upload promises to complete`);
    const responses = await Promise.all(promises);
    debug('All upload promises completed');

    for (let index = 0; index < responses.length; index++) {
      const res = responses[index];
      debug(`Checking response for part ${index + 1}, status: ${res.status}`);

      if (!res.ok) {
        debug(`Failed to upload part ${index + 1}: ${res.statusText} ${await res.text()}`);
        throw new Error(`Failed to upload part ${index + 1}: ${res.statusText}`);
      }

      const etag = res.headers.get('ETag');
      if (!etag) {
        debug(`Failed to get ETag for part ${index + 1}`);
        throw new Error(`Failed to get ETag for part ${index + 1}`);
      }

      debug(`Part ${index + 1} uploaded successfully, ETag: ${etag}`);
      finishedParts.push({
        partNumber: index + 1,
        etag: etag,
      });
    }

    debug(`Completing upload with ${finishedParts.length} parts`);
    await completeUpload(deploymentId, uploadId, finishedParts);
    debug('Upload completed successfully');
  } catch (err) {
    const error = err as Error;
    debug(`Upload error: ${error.message}`);
    addLog(`Upload error: ${error.message}`, 'ERROR', logs);
    throw error;
  }
};

const createDeployment = async ({ applicationId }: { applicationId: string }) => {
  debug(`Creating deployment for application: ${applicationId}`);
  const res = await fetch(`http://localhost:3000/${applicationId}/deployments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    duplex: 'half',
  });

  if (!res.ok) {
    const errorText = await res.text();
    debug(`Failed to create deployment: ${errorText}`);
    throw new Error('Failed to create deployment: ' + errorText);
  }

  const deployment = (await res.json()) as { id: string };
  debug(`Deployment created with ID: ${deployment.id}`);

  return deployment.id as string;
};

const startMultipartUpload = async (deploymentId: string) => {
  debug(`Starting multipart upload for deployment: ${deploymentId}`);
  const res = await fetch(`http://localhost:3000/deployments/${deploymentId}/pre-signed-url/start`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    debug(`Failed to start multipart upload: ${errorText}`);
    throw new Error('Failed to start multipart upload: ' + errorText);
  }

  const upload = (await res.json()) as { uploadId: string };
  debug(`Multipart upload started with ID: ${upload.uploadId}`);

  return upload.uploadId as string;
};

const getPresignedUrl = async (deploymentId: string, uploadId: string, partNumber: number) => {
  debug(`Getting presigned URL for deployment: ${deploymentId}, upload: ${uploadId}, part: ${partNumber}`);
  const res = await fetch(
    `http://localhost:3000/deployments/${deploymentId}/pre-signed-url/part?uploadId=${uploadId}&partNumber=${partNumber}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    debug(`Failed to get pre-signed URL: ${errorText}`);
    throw new Error('Failed to get pre-signed URL: ' + errorText);
  }

  const upload = (await res.json()) as { url: string };
  debug(`Got presigned URL for part ${partNumber}`);

  return upload.url as string;
};

const completeUpload = async (
  deploymentId: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
) => {
  debug(`Completing upload for deployment: ${deploymentId}, upload: ${uploadId}, parts: ${parts.length}`);
  const res = await fetch(`http://localhost:3000/deployments/${deploymentId}/pre-signed-url/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uploadId,
      parts,
    }),
    duplex: 'half',
  });

  if (!res.ok) {
    const errorText = await res.text();
    debug(`Failed to complete upload: ${errorText}`);
    throw new Error('Failed to complete upload: ' + errorText);
  }

  debug('Upload completed successfully');
};

const getDeploymentStatus = async (deploymentId: string) => {
  debug(`Getting deployment status for: ${deploymentId}`);
  const res = await fetch(`http://localhost:3000/deployments/${deploymentId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    debug(`Failed to get deployment status: ${errorText}`);
    throw new Error('Failed to get deployment status: ' + errorText);
  }

  const deployment = (await res.json()) as { status: DeploymentStatus };
  debug(`Deployment status: ${deployment.status}`);

  return deployment.status as DeploymentStatus;
};

const getLogs = async (
  deploymentId: string,
  options?: {
    offset: number;
    limit: number;
    'createdAt[gt]'?: string;
  }
) => {
  debug(`Getting logs for deployment: ${deploymentId}, options:`, options);
  const res = await fetch(`http://localhost:3000/deployments/${deploymentId}/logs${objectToQueryString(options)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    debug(`Failed to get logs: ${errorText}`);
    throw new Error('Failed to get logs: ' + errorText);
  }

  const logs = (await res.json()) as {
    totalItems: number;
    limit: number;
    offset: number;
    items: DeploymentLog[];
  };

  debug(`Got ${logs.items.length} logs, total: ${logs.totalItems}`);
  return logs;
};

type DeploymentStatus = 'PENDING' | 'BUILDING' | 'PROVISIONING' | 'FAILED' | 'ACTIVE' | 'SUSPENDED';

type DeploymentLog = { id: string; message: string; type: 'INFO' | 'ERROR' | 'WARN'; createdAt: string };
