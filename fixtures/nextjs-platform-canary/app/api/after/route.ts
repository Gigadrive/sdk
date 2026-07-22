import { after, connection } from 'next/server';

export async function GET() {
  await connection();
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  return Response.json({ after: 'registered' });
}
