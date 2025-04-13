/**
 * Translates Vercel region codes to AWS region codes.
 *
 * Vercel uses three-letter codes (e.g., "iad1") to identify their regions,
 * while AWS uses longer region codes (e.g., "us-east-1").
 * This function maps the Vercel region code to its corresponding AWS region code.
 *
 * @param region - The Vercel region code to translate
 * @returns The corresponding AWS region code, defaults to 'us-east-1' if not found
 * @link https://vercel.com/docs/edge-network/regions#region-list
 */
export const translateVercelRegion = (region: string): string => {
  const regionMap: Record<string, string> = {
    arn1: 'eu-north-1',
    bom1: 'ap-south-1',
    cdg1: 'eu-west-3',
    cle1: 'us-east-2',
    cpt1: 'af-south-1',
    dub1: 'eu-west-1',
    fra1: 'eu-central-1',
    gru1: 'sa-east-1',
    hkg1: 'ap-east-1',
    hnd1: 'ap-northeast-1',
    iad1: 'us-east-1',
    icn1: 'ap-northeast-2',
    kix1: 'ap-northeast-3',
    lhr1: 'eu-west-2',
    pdx1: 'us-west-2',
    sfo1: 'us-west-1',
    sin1: 'ap-southeast-1',
    syd1: 'ap-southeast-2',
  };

  return regionMap[region.toLowerCase()] ?? 'us-east-1';
};
