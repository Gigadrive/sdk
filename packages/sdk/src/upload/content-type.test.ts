import { describe, expect, it } from 'vitest';
import { inferContentType } from './content-type';

describe('inferContentType', () => {
  it('infers common MIME types from the extension', () => {
    expect(inferContentType('images/photo.png')).toBe('image/png');
    expect(inferContentType('reports/q1.pdf')).toBe('application/pdf');
    expect(inferContentType('archive.tar')).toBe('application/x-tar');
    expect(inferContentType('data.json')).toBe('application/json');
  });

  it('is case-insensitive on the extension', () => {
    expect(inferContentType('PHOTO.JPG')).toBe('image/jpeg');
  });

  it('returns undefined for unknown or missing extensions', () => {
    expect(inferContentType('file.unknownext')).toBeUndefined();
    expect(inferContentType('noextension')).toBeUndefined();
    expect(inferContentType('trailingdot.')).toBeUndefined();
  });
});
