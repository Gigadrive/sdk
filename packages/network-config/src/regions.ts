// Define all available runtimes in a single array
const REGION_DEFINITIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ap-south-1',
  'ap-northeast-3',
  'ap-northeast-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ca-central-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'sa-east-1',
] as const;

// Generate the Runtime type from the array
export type Region = (typeof REGION_DEFINITIONS)[number];

// Export the available runtimes
export const AVAILABLE_REGIONS: Region[] = [...REGION_DEFINITIONS];
