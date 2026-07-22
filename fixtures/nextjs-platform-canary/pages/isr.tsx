import type { GetStaticProps, InferGetStaticPropsType } from 'next';

// Next 16's GetStaticProps contract is asynchronous even for deterministic fixtures.
// eslint-disable-next-line @typescript-eslint/require-await
export const getStaticProps = (async () => {
  return {
    props: { token: `${Date.now()}-${crypto.randomUUID()}` },
    revalidate: 60,
  };
}) satisfies GetStaticProps<{ token: string }>;

export default function IsrPage({ token }: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <main>
      <h1>ISR</h1>
      <output id="isr-token">{token}</output>
    </main>
  );
}
