import { Layer } from 'effect';
import { RawConfigReader } from './raw-config-reader';
import { SchemaValidator } from './schema-validator';
import { V4ConfigParser } from './v4-config-parser';
import { VercelBuildOutputParser } from './vercel-build-output-parser';

export { ALLOWED_CONFIG_NAMES, RawConfigReader } from './raw-config-reader';
export { SchemaValidator } from './schema-validator';
export { getFunctionSettings, V4ConfigParser } from './v4-config-parser';
export { VercelBuildOutputParser } from './vercel-build-output-parser';

/**
 * Composed layer providing all network-config services.
 * Requires `FileSystem.FileSystem` (e.g. via `NodeContext.layer`).
 */
const BaseLayers = Layer.mergeAll(RawConfigReader.Default, SchemaValidator.Default, V4ConfigParser.Default);

export const NetworkConfigLive = VercelBuildOutputParser.Default.pipe(Layer.provideMerge(BaseLayers));
