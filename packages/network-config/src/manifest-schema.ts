import { Option, Schema } from 'effect';

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
  Schema.filter((value) => value.startsWith('/') && !value.includes('?') && !value.includes('#'))
);

/** Decode a JSON string with an Effect schema, returning `undefined` on invalid input. */
export const decodeJson = <A, I>(schema: Schema.Schema<A, I, never>, content: string): A | undefined =>
  Schema.decodeUnknownOption(Schema.parseJson(schema), { onExcessProperty: 'preserve' })(content).pipe(
    Option.getOrUndefined
  );
