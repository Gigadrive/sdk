import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { ReadableStream as WebReadableStream } from 'stream/web';

/**
 * Downloads a file from a URL using streaming to avoid loading it into memory
 * @param url - The URL of the file to download
 * @param outputPath - The local path where the file should be saved
 * @returns Promise that resolves when download is complete
 */
export async function downloadFile(url: string, outputPath: string): Promise<void> {
  try {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Fetch the file with streaming enabled
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Convert Web ReadableStream to Node.js Readable Stream
    // Using type assertion to handle the type mismatch
    const nodeStream = Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>);

    // Create write stream
    const fileStream = fs.createWriteStream(outputPath);

    // Pipe the response body to the file stream
    return new Promise((resolve, reject) => {
      nodeStream.pipe(fileStream);

      nodeStream.on('error', (error) => {
        reject(error);
      });

      fileStream.on('finish', () => {
        resolve();
      });

      fileStream.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    throw new Error(`Failed to download file: ${error}`);
  }
}
