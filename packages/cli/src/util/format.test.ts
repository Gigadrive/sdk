import { describe, expect, test } from 'vitest';
import { formatFileSize } from './format';

describe('formatFileSize', function () {
  test('should return "0 B" for 0 bytes', function () {
    expect(formatFileSize(0)).toEqual('0 B');
  });

  test('should return "1 B" for 1 byte', function () {
    expect(formatFileSize(1)).toEqual('1 B');
  });

  test('should return "1 KB" for 1024 bytes', function () {
    expect(formatFileSize(1024)).toEqual('1 KB');
  });

  test('should return "1 MB" for 1048576 bytes', function () {
    expect(formatFileSize(1048576)).toEqual('1 MB');
  });

  test('should return "1 GB" for 1073741824 bytes', function () {
    expect(formatFileSize(1073741824)).toEqual('1 GB');
  });

  test('should return "1 TB" for 1099511627776 bytes', function () {
    expect(formatFileSize(1099511627776)).toEqual('1 TB');
  });

  test('should return "100 B" for 100 bytes', function () {
    expect(formatFileSize(100)).toEqual('100 B');
  });

  test('should return "999 B" for 999 bytes', function () {
    expect(formatFileSize(999)).toEqual('999 B');
  });

  test('should return "1.23 KB" for 1260 bytes', function () {
    expect(formatFileSize(1260)).toEqual('1.23 KB');
  });

  test('should return "1.5 KB" for 1536 bytes', function () {
    expect(formatFileSize(1536)).toEqual('1.5 KB');
  });

  test('should return "2 MB" for 2097152 bytes', function () {
    expect(formatFileSize(2097152)).toEqual('2 MB');
  });

  test('should return "2.5 MB" for 2621440 bytes', function () {
    expect(formatFileSize(2621440)).toEqual('2.5 MB');
  });

  test('should return "1.5 GB" for 1610612736 bytes', function () {
    expect(formatFileSize(1610612736)).toEqual('1.5 GB');
  });

  test('should return "2.50 GB" for 2684354560 bytes', function () {
    expect(formatFileSize(2684354560)).toEqual('2.5 GB');
  });

  test('should return "1.50 TB" for 1649267441664 bytes', function () {
    expect(formatFileSize(1649267441664)).toEqual('1.5 TB');
  });

  test('should return "117.74 MB" for 123456789 bytes', function () {
    expect(formatFileSize(123456789)).toEqual('117.74 MB');
  });
});
