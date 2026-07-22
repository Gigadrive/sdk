import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';

// Next 16's GetServerSideProps contract is asynchronous even for deterministic fixtures.
// eslint-disable-next-line @typescript-eslint/require-await
export const getServerSideProps = (async () => {
  return { props: { router: 'pages' } };
}) satisfies GetServerSideProps<{ router: string }>;

export default function LegacyPage({ router }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <output id="legacy-page">{router}</output>;
}
