import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(_request: NextApiRequest, response: NextApiResponse) {
  await response.revalidate('/isr');
  response.status(200).json({ isrRevalidated: true });
}
