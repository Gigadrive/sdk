import { Runtime } from '../runtime';

/**
 * Translates Vercel runtime strings to our standardized Runtime format
 *
 * @param runtime - The Vercel runtime identifier (e.g. 'nodejs18.x')
 * @returns The corresponding Runtime value or null if no match is found
 */
export const translateVercelRuntime = (runtime: string): Runtime | null => {
  switch (runtime) {
    case 'nodejs12.x':
    case 'nodejs14.x':
    case 'nodejs16.x':
    case 'nodejs18.x':
      return 'node-18';
    case 'nodejs20.x':
    case 'nodejs22.x': // TODO: Update when Lambda supports Node.js 22
      return 'node-20';
    default:
      return null;
  }
};
