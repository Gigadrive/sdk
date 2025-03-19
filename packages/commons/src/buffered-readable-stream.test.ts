import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { BufferedReadableStream } from './buffered-readable-stream';

describe('BufferedReadableStream', () => {
  it('should be an instance of Readable', () => {
    const stream = new BufferedReadableStream();
    expect(stream).toBeInstanceOf(Readable);
  });

  it('should write data to buffer and read it as a stream', () => {
    return new Promise<void>((resolve) => {
      const stream = new BufferedReadableStream();
      stream.writeToBuffer('Hello, ');
      stream.writeToBuffer('world!');
      stream.end();

      let result = '';
      stream.on('data', (chunk) => {
        result += chunk.toString();
      });
      stream.on('end', () => {
        expect(result).toBe('Hello, world!');
        resolve();
      });
    });
  }, 1000); // 1 second timeout

  it('should allow getting buffer content', () => {
    const stream = new BufferedReadableStream();
    stream.writeToBuffer('Test data');
    expect(stream.getBufferContent()).toBe('Test data');
  });

  it('should not end stream until end() is called', async () => {
    const stream = new BufferedReadableStream();
    stream.writeToBuffer('Data 1');

    const readPromise = new Promise<string>((resolve) => {
      let data = '';
      stream.on('data', (chunk) => {
        data += chunk.toString();
      });
      stream.on('end', () => {
        resolve(data);
      });
    });

    // Write more data after a delay
    await new Promise((resolve) => setTimeout(resolve, 10));
    stream.writeToBuffer('Data 2');

    // End the stream
    stream.end();

    const result = await readPromise;
    expect(result).toBe('Data 1Data 2');
  });

  it('should throw error when writing after end', () => {
    const stream = new BufferedReadableStream();
    stream.writeToBuffer('Data');
    stream.end();

    expect(() => {
      stream.writeToBuffer('More data');
    }).toThrow('Cannot write to stream after end() has been called');
  });

  it('should handle large amounts of data', async () => {
    const stream = new BufferedReadableStream();
    const largeData = 'x'.repeat(1000000); // 1MB of data
    stream.writeToBuffer(largeData);
    stream.end();

    return new Promise<void>((resolve) => {
      let result = '';
      stream.on('data', (chunk) => {
        result += chunk.toString();
      });
      stream.on('end', () => {
        expect(result.length).toBe(1000000);
        expect(result).toBe(largeData);
        resolve();
      });
    });
  }, 5000); // 5 second timeout
});
