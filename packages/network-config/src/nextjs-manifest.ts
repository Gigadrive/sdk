import { Schema } from 'effect';
import type { NormalizedImagePolicy } from './image-policy';
import {
  decodeJson,
  HttpHeadersSchema,
  HttpSingleValueHeadersSchema,
  PortableRelativePathSchema,
  RepositoryRelativePathSchema,
  UrlPathnameSchema,
} from './manifest-schema';

/** JSON values accepted in the portable Next.js adapter manifest. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const StringArraySchema = Schema.mutable(Schema.Array(Schema.String));
const StringRecordSchema = Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.String }));

const JsonValueSchema: Schema.Schema<JsonValue> = Schema.suspend(() =>
  Schema.Union(
    Schema.Null,
    Schema.Boolean,
    Schema.Number,
    Schema.String,
    Schema.mutable(Schema.Array(JsonValueSchema)),
    Schema.mutable(Schema.Record({ key: Schema.String, value: JsonValueSchema }))
  )
);

const ImageLocalPatternSchema = Schema.mutable(
  Schema.Struct({
    pathname: Schema.optional(Schema.String),
    search: Schema.optional(Schema.String),
  })
);
const ImageRemotePatternSchema = Schema.mutable(
  Schema.Struct({
    protocol: Schema.optional(Schema.Literal('http', 'https')),
    hostname: Schema.String,
    port: Schema.optional(Schema.String),
    pathname: Schema.optional(Schema.String),
    search: Schema.optional(Schema.String),
  })
);
const ImageVariantSchema = Schema.mutable(
  Schema.Struct({
    width: Schema.optional(Schema.Number),
    height: Schema.optional(Schema.Number),
    quality: Schema.optional(Schema.Number),
    format: Schema.optional(Schema.Literal('image/avif', 'image/webp', 'image/jpeg', 'image/png')),
    fit: Schema.optional(Schema.Literal('contain', 'cover', 'fill', 'inside', 'outside')),
  })
);
const PositiveIntSchema = Schema.Int.pipe(Schema.greaterThan(0));
const ImagePolicySchema: Schema.Schema<NormalizedImagePolicy> = Schema.mutable(
  Schema.Struct({
    localPatterns: Schema.mutable(Schema.Array(ImageLocalPatternSchema)),
    remotePatterns: Schema.mutable(Schema.Array(ImageRemotePatternSchema)),
    widths: Schema.mutable(Schema.Array(PositiveIntSchema)),
    heights: Schema.mutable(Schema.Array(PositiveIntSchema)),
    qualities: Schema.mutable(Schema.Array(Schema.Number.pipe(Schema.between(1, 100)))),
    formats: Schema.mutable(Schema.Array(Schema.Literal('image/avif', 'image/webp', 'image/jpeg', 'image/png'))),
    minimumCacheTTL: Schema.Number,
    dangerouslyAllowSVG: Schema.Boolean,
    contentSecurityPolicy: Schema.String,
    contentDispositionType: Schema.Literal('inline', 'attachment'),
    maximumRedirects: Schema.Number,
    maximumResponseBody: Schema.Number,
    variants: Schema.mutable(Schema.Record({ key: Schema.String, value: ImageVariantSchema })),
  })
);

export const GigadriveNextPrerenderOutputSchema = Schema.mutable(
  Schema.Struct({
    id: Schema.String,
    type: Schema.Literal('PRERENDER'),
    pathname: UrlPathnameSchema,
    parentOutputId: Schema.String,
    groupId: Schema.Number,
    pprChain: Schema.optional(Schema.mutable(Schema.Struct({ headers: HttpSingleValueHeadersSchema }))),
    parentFallbackMode: Schema.optional(JsonValueSchema),
    fallback: Schema.optional(
      Schema.mutable(
        Schema.Struct({
          filePath: Schema.optional(PortableRelativePathSchema),
          initialStatus: Schema.optional(Schema.Int.pipe(Schema.between(100, 599))),
          initialHeaders: Schema.optional(HttpHeadersSchema),
          initialExpiration: Schema.optional(Schema.Number),
          initialRevalidate: Schema.optional(Schema.Union(Schema.Number, Schema.Literal(false))),
          postponedState: Schema.optional(Schema.String),
        })
      )
    ),
    config: Schema.mutable(
      Schema.Struct({
        allowQuery: Schema.optional(StringArraySchema),
        allowHeader: Schema.optional(StringArraySchema),
        bypassFor: Schema.optional(Schema.mutable(Schema.Array(JsonValueSchema))),
        renderingMode: Schema.optional(Schema.String),
        partialFallback: Schema.optional(Schema.Boolean),
        bypassToken: Schema.optional(Schema.String),
      })
    ),
  })
);
export type GigadriveNextPrerenderOutput = Schema.Schema.Type<typeof GigadriveNextPrerenderOutputSchema>;

/** A directory subtree published under one URL prefix. */
export const GigadriveNextStaticAssetPrefixSchema = Schema.mutable(
  Schema.Struct({
    sourceDir: PortableRelativePathSchema,
    urlPrefix: PortableRelativePathSchema,
    immutable: Schema.Boolean,
  })
);
export type GigadriveNextStaticAssetPrefix = Schema.Schema.Type<typeof GigadriveNextStaticAssetPrefixSchema>;

/** Aggregated runtime configuration for the standalone server. */
export const GigadriveNextServerDescriptorSchema = Schema.mutable(
  Schema.Struct({
    maxDuration: Schema.optional(Schema.Number),
    preferredRegion: Schema.optional(Schema.Union(Schema.String, StringArraySchema)),
    env: Schema.optional(StringRecordSchema),
  })
);
export type GigadriveNextServerDescriptor = Schema.Schema.Type<typeof GigadriveNextServerDescriptorSchema>;

const PrerenderArraySchema = Schema.mutable(Schema.Array(GigadriveNextPrerenderOutputSchema));
const StaticAssetArraySchema = Schema.mutable(Schema.Array(GigadriveNextStaticAssetPrefixSchema));
const JsonValueArraySchema = Schema.mutable(Schema.Array(JsonValueSchema));

export const GigadriveNextBuildManifestV1Schema = Schema.mutable(
  Schema.Struct({
    version: Schema.Literal(1),
    output: Schema.Literal('standalone', 'export'),
    distDir: PortableRelativePathSchema,
    repoRootToProject: RepositoryRelativePathSchema,
    nextVersion: Schema.String,
    buildId: Schema.String,
  })
);
export type GigadriveNextBuildManifestV1 = Schema.Schema.Type<typeof GigadriveNextBuildManifestV1Schema>;

/** Minimal plan for static-export builds. */
export const GigadriveNextBuildManifestV2ExportSchema = Schema.mutable(
  Schema.Struct({
    version: Schema.Literal(2),
    mode: Schema.Literal('export'),
    distDir: PortableRelativePathSchema,
    repoRootToProject: RepositoryRelativePathSchema,
    nextVersion: Schema.String,
    buildId: Schema.String,
  })
);
export type GigadriveNextBuildManifestV2Export = Schema.Schema.Type<typeof GigadriveNextBuildManifestV2ExportSchema>;

/** Portable runtime plan for a standalone Next.js server. */
export const GigadriveNextBuildManifestV2StandaloneSchema = Schema.mutable(
  Schema.Struct({
    version: Schema.Literal(2),
    mode: Schema.Literal('standalone-v2'),
    distDir: PortableRelativePathSchema,
    repoRootToProject: RepositoryRelativePathSchema,
    nextVersion: Schema.String,
    buildId: Schema.String,
    server: GigadriveNextServerDescriptorSchema,
    config: Schema.mutable(
      Schema.Struct({
        basePath: Schema.String,
        trailingSlash: Schema.Boolean,
        cacheComponents: Schema.Boolean,
        i18n: Schema.optional(JsonValueSchema),
        images: Schema.optional(ImagePolicySchema),
      })
    ),
    routing: Schema.mutable(
      Schema.Struct({
        beforeMiddleware: JsonValueArraySchema,
        beforeFiles: JsonValueArraySchema,
        afterFiles: JsonValueArraySchema,
        dynamicRoutes: JsonValueArraySchema,
        onMatch: JsonValueArraySchema,
        fallback: JsonValueArraySchema,
        shouldNormalizeNextData: Schema.Boolean,
        rsc: JsonValueSchema,
      })
    ),
    outputs: Schema.mutable(
      Schema.Struct({
        prerenders: PrerenderArraySchema,
        prerenderManifest: Schema.optional(PortableRelativePathSchema),
        assetManifest: Schema.optional(PortableRelativePathSchema),
        entryPagePaths: Schema.optional(Schema.mutable(Schema.Array(UrlPathnameSchema))),
        staticAssets: StaticAssetArraySchema,
      })
    ),
  })
);
export type GigadriveNextBuildManifestV2Standalone = Schema.Schema.Type<
  typeof GigadriveNextBuildManifestV2StandaloneSchema
>;

export const GigadriveNextBuildManifestSchema = Schema.Union(
  GigadriveNextBuildManifestV1Schema,
  GigadriveNextBuildManifestV2ExportSchema,
  GigadriveNextBuildManifestV2StandaloneSchema
);
export type GigadriveNextBuildManifestV2 = GigadriveNextBuildManifestV2Standalone | GigadriveNextBuildManifestV2Export;
export type GigadriveNextBuildManifest = Schema.Schema.Type<typeof GigadriveNextBuildManifestSchema>;

/** Portable sidecar containing high-cardinality Next.js prerender metadata. */
export const GigadriveNextPrerenderManifestV1Schema = Schema.mutable(
  Schema.Struct({
    version: Schema.Literal(1),
    prerenders: PrerenderArraySchema,
  })
);
export type GigadriveNextPrerenderManifestV1 = Schema.Schema.Type<typeof GigadriveNextPrerenderManifestV1Schema>;

/** Parses and structurally validates adapter metadata before deployment code consumes it. */
export const parseGigadriveNextBuildManifest = (content: string): GigadriveNextBuildManifest | undefined =>
  decodeJson(GigadriveNextBuildManifestSchema, content);

/** Parses and validates a portable Next.js prerender sidecar. */
export const parseGigadriveNextPrerenderManifest = (content: string): GigadriveNextPrerenderManifestV1 | undefined =>
  decodeJson(GigadriveNextPrerenderManifestV1Schema, content);
