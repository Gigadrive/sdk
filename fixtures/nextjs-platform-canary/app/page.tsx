import Image from 'next/image';

export default function Home() {
  return (
    <main>
      <h1>Gigadrive Next.js platform canary</h1>
      <Image src="/canary.png" alt="Canary" width={64} height={64} priority />
    </main>
  );
}
