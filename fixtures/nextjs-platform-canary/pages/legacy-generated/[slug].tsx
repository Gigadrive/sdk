import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';

export const getStaticPaths = (() => ({
  paths: [{ params: { slug: 'first' } }],
  fallback: 'blocking',
})) satisfies GetStaticPaths;

export const getStaticProps = (({ params }) =>
  Promise.resolve({
    props: { slug: String(params?.slug) },
    revalidate: false as const,
  })) satisfies GetStaticProps<{ slug: string }>;

export default function LegacyGeneratedPage({ slug }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <output id="legacy-generated-slug">{slug}</output>;
}
