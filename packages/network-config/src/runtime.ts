// Define all available runtimes in a single array
const RUNTIME_DEFINITIONS = [
  'php-84',
  'php-83',
  'php-81',
  'node-22',
  'node-20',
  'node-18',
  'node-16',
  'bun-1',
] as const;

// Generate the Runtime type from the array
export type Runtime = (typeof RUNTIME_DEFINITIONS)[number];

// Export the available runtimes
export const AVAILABLE_RUNTIMES: Runtime[] = [...RUNTIME_DEFINITIONS];
