/**
 * A preset default the platform replaces with a generated secret when a
 * function starts: stable for the application's environment across
 * deployments, distinct per environment and variable, and overridden by any
 * value the application stores itself. Never written into a package or the
 * deployment record.
 *
 * - `laravel-app-key`: `base64:` and 32 bytes, the shape of Laravel's `APP_KEY`.
 * - `hex`: 64 hex characters.
 */
export const generatedSecret = (format: 'laravel-app-key' | 'hex') => `{{gigadrive.secret:${format}}}`;
