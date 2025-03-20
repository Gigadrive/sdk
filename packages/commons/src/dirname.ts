import { getDirname } from './get-dirname';

/**
 * The directory name of the current module.
 * This is equivalent to __dirname in CommonJS modules.
 */
export const __dirname: string = getDirname(import.meta.url);
