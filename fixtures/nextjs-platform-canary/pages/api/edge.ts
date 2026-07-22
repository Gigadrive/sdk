export const config = {
  runtime: 'edge',
};

export default function handler() {
  return Response.json({ runtime: 'edge', route: 'pages-api' });
}
