export function generateStaticParams() {
  return [{ slug: 'first' }];
}

export default async function GeneratedPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  return <output id="generated-slug">{slug}</output>;
}
