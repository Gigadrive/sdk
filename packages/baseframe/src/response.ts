import superjson from 'superjson';

export const json = (body: unknown, options: ResponseInit = {}): Response => {
  return new Response(superjson.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
};

export const error = (message: string | object, statusCode: number = 500): Response => {
  return json({ error: message }, { status: statusCode });
};

export const NOT_FOUND: Response = error('Not found', 404);
export const BAD_REQUEST: Response = error('Bad request', 400);
export const INTERNAL_SERVER_ERROR: Response = error('Internal server error', 500);
