import { Readable, type ReadableOptions } from 'stream';

/**
 * A readable stream that buffers data until it is read.
 *
 * This class extends Node.js's Readable stream and provides functionality
 * to buffer data in memory until it is consumed by readers. It allows writing
 * data to an internal buffer and controls when the stream ends.
 */
export class BufferedReadableStream extends Readable {
  /**
   * Internal buffer to store data until it's read
   */
  private buffer: Buffer;

  /**
   * Current read position in the buffer
   */
  private position: number;

  /**
   * Flag indicating if the stream is in the process of ending
   */
  private isEnding: boolean;

  /**
   * Creates a new BufferedReadableStream
   *
   * @param options - Standard Node.js ReadableOptions
   */
  constructor(options: ReadableOptions = {}) {
    super(options);
    this.buffer = Buffer.alloc(0);
    this.position = 0;
    this.isEnding = false;
  }

  /**
   * Implementation of the _read method required by Readable
   * Pushes data from the buffer to the stream when requested
   *
   * @param size - Number of bytes to read
   */
  override _read(size: number): void {
    if (this.position >= this.buffer.length) {
      // If we've read all data in the buffer
      if (this.isEnding) {
        this.push(null); // Signal end of stream
      }
      // Otherwise, wait for more data to be written
    } else {
      // Read a chunk from the buffer
      const chunk = this.buffer.slice(this.position, this.position + size);
      this.push(chunk);
      this.position += chunk.length;
    }
  }

  /**
   * Writes data to the internal buffer
   *
   * @param data - Data to write (string, Buffer, or Uint8Array)
   * @throws Error if attempting to write after the stream has ended
   */
  writeToBuffer(data: string | Buffer | Uint8Array): void {
    if (this.isEnding) {
      throw new Error('Cannot write to stream after end() has been called');
    }

    const newBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);

    this.buffer = Buffer.concat([this.buffer, newBuffer]);
    this.push(''); // Signal that new data is available
  }

  /**
   * Returns the current content of the buffer as a string
   *
   * @returns The buffer content as a UTF-8 string
   */
  getBufferContent(): string {
    return this.buffer.toString();
  }

  /**
   * Marks the stream as ending, which will cause it to emit 'end'
   * after all buffered data has been read
   */
  end(): void {
    this.isEnding = true;
    this.push(''); // Trigger a read to potentially end the stream
  }
}
