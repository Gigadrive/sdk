import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';

/**
 * Declares one Pages Router path and disables fallback generation.
 *
 * @returns The build paths with fallback disabled.
 * @example
 * ```ts
 * await getStaticPaths({});
 * ```
 */
export const getStaticPaths = (() => ({
  paths: [{ params: { slug: 'first' } }],
  fallback: false,
})) satisfies GetStaticPaths;

/**
 * Supplies immutable props for a strict generated Pages Router path.
 *
 * @param context - Next's static-generation context.
 * @returns Props containing the requested slug.
 * @example
 * ```ts
 * await getStaticProps({ params: { slug: 'first' } });
 * ```
 */
export const getStaticProps = ((context) =>
  Promise.resolve({
    props: { slug: String(context.params?.slug) },
    revalidate: false as const,
  })) satisfies GetStaticProps<{ slug: string }>;

/**
 * Renders a generated Pages Router slug with fallback disabled.
 *
 * @param props - Static props containing the generated slug.
 * @returns The generated slug marker.
 * @example
 * ```tsx
 * <LegacyGeneratedStrictPage slug="first" />
 * ```
 */
export default function LegacyGeneratedStrictPage({ slug }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <output id="legacy-generated-strict-slug">{slug}</output>;
}
