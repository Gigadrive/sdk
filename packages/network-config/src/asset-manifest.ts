import { Schema } from 'effect';
import { decodeJson, PortableRelativePathSchema, UrlPathnameSchema } from './manifest-schema';

const StringArraySchema = Schema.mutable(Schema.Array(Schema.String));
export const StaticAssetHeadersSchema = Schema.mutable(
  Schema.Record({ key: Schema.String, value: Schema.Union(Schema.String, StringArraySchema) })
);
export type StaticAssetHeaders = Schema.Schema.Type<typeof StaticAssetHeadersSchema>;

/** One logical static asset whose source is relative to the project root. */
export const StaticAssetManifestEntrySchema = Schema.mutable(
  Schema.Struct({
    source: PortableRelativePathSchema,
    path: UrlPathnameSchema,
    status: Schema.optional(Schema.Int.pipe(Schema.between(100, 599))),
    headers: Schema.optional(StaticAssetHeadersSchema),
    immutable: Schema.optional(Schema.Boolean),
  })
);
export type StaticAssetManifestEntry = Schema.Schema.Type<typeof StaticAssetManifestEntrySchema>;

/** Portable manifest for declaring many logical assets without expanding deployment configuration. */
export const StaticAssetManifestV1Schema = Schema.mutable(
  Schema.Struct({
    version: Schema.Literal(1),
    assets: Schema.mutable(Schema.Array(StaticAssetManifestEntrySchema)),
  })
).pipe(Schema.filter(({ assets }) => new Set(assets.map(({ path }) => path)).size === assets.length));
export type StaticAssetManifestV1 = Schema.Schema.Type<typeof StaticAssetManifestV1Schema>;
export type StaticAssetManifest = StaticAssetManifestV1;

/**
 * Parses and validates a portable static asset manifest.
 *
 * @param content JSON manifest content.
 * @returns The validated manifest, or `undefined` when malformed.
 */
export const parseStaticAssetManifest = (content: string): StaticAssetManifest | undefined =>
  decodeJson(StaticAssetManifestV1Schema, content);
