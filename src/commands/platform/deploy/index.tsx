import { Alert, Spinner, ThemeProvider } from '@inkjs/ui';
import { $ } from 'bun';
import type { Command } from 'commander';
import fs from 'fs';
import { Box, render, Static, Text, type Instance } from 'ink';
import { useEffect, useState } from 'react';
import { debug, isVerbose } from '../../../util/log';
import { theme } from '../../../util/theme';
import { objectToQueryString } from '../../../util/url';

let instance: Instance | undefined;

export const deploy = (parent: Command) => {
  parent
    .command('deploy')
    .description('Deploy the current project')
    .action(async () => {
      const deploymentId = await createDeployment({
        applicationId: 'test', // TODO
      });

      debug(`Deployment ID: ${deploymentId}`);

      instance = render(<LogDisplay deploymentId={deploymentId} />);
    });
};

const LogDisplay = ({ deploymentId }: { deploymentId: string }) => {
  const [status, setStatus] = useState<DeploymentStatus>('PENDING');
  const [logs, setLogs] = useState<DeploymentLog[]>([]);

  // start upload
  useEffect(() => {
    uploadArchive(deploymentId, setLogs).then(() => {
      addLog('Upload complete.', 'INFO', setLogs);
      addLog('The deployment pipeline is now being provisioned. This may take a few seconds.', 'INFO', setLogs);
    });
  }, []);

  // update status every second
  useEffect(() => {
    const interval = setInterval(async () => {
      const newStatus = await getDeploymentStatus(deploymentId);

      if (newStatus === 'ACTIVE' || newStatus === 'FAILED') {
        // delay final status update to show logs
        setTimeout(() => {
          setStatus(newStatus);
        }, 2000);

        clearInterval(interval);
        return;
      }

      if (newStatus !== status) {
        setStatus(newStatus);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // fetch logs every second, pass latest date to only get new logs
  useEffect(() => {
    const interval = setInterval(async () => {
      const newLogs = await getLogs(deploymentId, {
        offset: logs.length,
        limit: 100,
        'createdAt[gt]': logs[logs.length - 1]?.createdAt,
      });

      setLogs((prevLogs) => [...prevLogs, ...newLogs.items]);
    }, 1000);

    return () => clearInterval(interval);
  }, [logs]);

  if (status === 'ACTIVE') {
    instance?.clear();

    setTimeout(() => {
      instance?.unmount();
    }, 100);

    return <Alert variant="success">Deployed to https://{deploymentId}.gigadrivedev.com</Alert>;
  }

  if (status === 'FAILED' || status === 'SUSPENDED') {
    instance?.clear();

    setTimeout(() => {
      instance?.unmount();
    }, 100);

    return <Alert variant="error">The deployment failed. Please check the logs for more information.</Alert>;
  }

  // show latest 5 logs
  return (
    <ThemeProvider theme={theme}>
      <Box>
        <Box marginTop={1}>
          <Spinner label={`Status: ${status.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}`} />
        </Box>

        <Static items={logs}>
          {(log) => {
            const color = log.type === 'ERROR' ? 'red' : log.type === 'WARN' ? 'yellow' : 'grey';

            return (
              <Text key={log.id} color={color}>
                {log.message}
              </Text>
            );
          }}
        </Static>
      </Box>
    </ThemeProvider>
  );
};

const addLog = (
  message: string,
  type: 'INFO' | 'ERROR' | 'WARN',
  setLogs: React.Dispatch<React.SetStateAction<DeploymentLog[]>>
) => {
  setLogs((prevLogs: DeploymentLog[]) => [
    ...prevLogs,
    { id: String(prevLogs.length), message, type, createdAt: new Date().toISOString() },
  ]);
};

const uploadArchive = async (deploymentId: string, setLogs: React.Dispatch<React.SetStateAction<DeploymentLog[]>>) => {
  addLog('Creating archive...', 'INFO', setLogs);

  const archivePath = '/tmp/project.zip';

  if (fs.existsSync(archivePath)) {
    fs.unlinkSync(archivePath);
  }

  await zipFolder(process.cwd(), archivePath, { verbose: isVerbose() });

  addLog('Uploading archive...', 'INFO', setLogs);

  const uploadId = await startMultipartUpload(deploymentId);

  debug(`Upload ID: ${uploadId}`);

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
};

const createDeployment = async ({ applicationId }: { applicationId: string }) => {
  const res = await fetch(`http://localhost:3000/${applicationId}/deployments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error('Failed to create deployment: ' + (await res.text()));
  }

  const deployment = await res.json();

  return deployment.id as string;
};

const startMultipartUpload = async (deploymentId: string) => {
  const res = await fetch(`http://localhost:3000/deployments/${deploymentId}/pre-signed-url/start`, {
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
    `http://localhost:3000/deployments/${deploymentId}/pre-signed-url/part?uploadId=${uploadId}&partNumber=${partNumber}`,
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
  const res = await fetch(`http://localhost:3000/deployments/${deploymentId}/pre-signed-url/complete`, {
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

const getDeploymentStatus = async (deploymentId: string) => {
  const res = await fetch(`http://localhost:3000/deployments/${deploymentId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error('Failed to get deployment status: ' + (await res.text()));
  }

  const deployment = await res.json();

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
  const res = await fetch(`http://localhost:3000/deployments/${deploymentId}/logs${objectToQueryString(options)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error('Failed to get logs: ' + (await res.text()));
  }

  return (await res.json()) as {
    totalItems: number;
    limit: number;
    offset: number;
    items: DeploymentLog[];
  };
};

type DeploymentStatus = 'PENDING' | 'BUILDING' | 'PROVISIONING' | 'FAILED' | 'ACTIVE' | 'SUSPENDED';

type DeploymentLog = { id: string; message: string; type: 'INFO' | 'ERROR' | 'WARN'; createdAt: string };
