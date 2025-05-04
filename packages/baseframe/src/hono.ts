import { HonoRequest } from 'hono';
import { createMiddleware } from 'hono/factory';
import { BaseframeOptions } from '.';
import { routeRequest } from './routing';

export const baseframe = (options: BaseframeOptions) =>
  createMiddleware(async (c, next) => {
    const response = await routeRequest({
      request: await honoRequestToFetchRequest(c.req),
      options,
    });

    if (response) {
      c.res = response;
    }

    await next();
  });

export const honoRequestToFetchRequest = async (request: HonoRequest): Promise<Request> => {
  const body = await request.arrayBuffer();
  return new Request(request.url, {
    method: request.method,
    headers: request.header(),
    body: body.byteLength > 0 ? body : null,
    duplex: 'half',
  });
};
