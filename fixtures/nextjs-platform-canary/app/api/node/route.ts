import { connection } from 'next/server';

export const maxDuration = 10;
export const preferredRegion = ['fra1', 'iad1'];

export async function GET() {
  await connection();
  return Response.json({ runtime: 'nodejs', route: 'app' });
}
