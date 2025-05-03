import { createMiddleware } from 'hono/factory';
import { BaseframeOptions } from '.';

const baseframe = (options: BaseframeOptions) =>
  createMiddleware(async (c, next) => {
    await next();
  });
