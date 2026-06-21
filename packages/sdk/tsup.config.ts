import { index } from '@local/tsup';

const existingExternal = Array.isArray(index.external) ? index.external : [];

// Keep Node built-ins external — they are only reached via guarded dynamic
// imports in Node, and must not be bundled into the browser (IIFE/ESM) output.
export default {
  ...index,
  external: [...existingExternal, 'node:fs', 'node:crypto', 'node:stream', 'node:path'],
};
