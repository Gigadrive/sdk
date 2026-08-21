import { Option, Schema } from 'effect';

const HTTP_HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const HTTP_HEADER_VALUE = /^[\t\x20-\x7e\x80-\xff]*$/;
const URL_PATHNAME_FORBIDDEN_CHARACTER = /[\x00-\x1f\x7f?#\\]/;

const isPortableRelativePath = (value: string, allowCurrentDirectory = false): boolean => {
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  return (
    (allowCurrentDirectory || (normalized !== '' && normalized !== '.')) &&
    !normalized.startsWith('/') &&
    !/^[A-Za-z]:/.test(normalized) &&
    !normalized.includes(':') &&
    !normalized.split('/').includes('..')
  );
};

export const PortableRelativePathSchema = Schema.String.pipe(Schema.filter((value) => isPortableRelativePath(value)));

export const RepositoryRelativePathSchema = Schema.String.pipe(
  Schema.filter((value) => isPortableRelativePath(value, true))
);

export const UrlPathnameSchema = Schema.String.pipe(
  Schema.filter(
    (value) =>
      value.startsWith('/') && !URL_PATHNAME_FORBIDDEN_CHARACTER.test(value) && !value.split('/').includes('..')
  )
);

export const HttpHeaderValueSchema = Schema.String.pipe(Schema.pattern(HTTP_HEADER_VALUE));
export const HttpHeadersSchema = Schema.mutable(
  Schema.Record({
    key: Schema.String,
    value: Schema.Union(HttpHeaderValueSchema, Schema.mutable(Schema.Array(HttpHeaderValueSchema))),
  })
).pipe(Schema.filter((headers) => Object.keys(headers).every((name) => HTTP_HEADER_NAME.test(name))));
export const HttpSingleValueHeadersSchema = Schema.mutable(
  Schema.Record({ key: Schema.String, value: HttpHeaderValueSchema })
).pipe(Schema.filter((headers) => Object.keys(headers).every((name) => HTTP_HEADER_NAME.test(name))));

/** Decode an unknown value with an Effect schema, returning `undefined` on invalid input. */
export const decodeUnknown = <A, I>(schema: Schema.Schema<A, I, never>, value: unknown): A | undefined =>
  Schema.decodeUnknownOption(schema, { onExcessProperty: 'preserve' })(value).pipe(Option.getOrUndefined);

/** Decode a JSON string with an Effect schema, returning `undefined` on invalid input. */
export const decodeJson = <A, I>(schema: Schema.Schema<A, I, never>, content: string): A | undefined =>
  decodeUnknown(Schema.parseJson(schema), content);
