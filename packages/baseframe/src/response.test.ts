import superjson from 'superjson';
import { describe, expect, it } from 'vitest';
import { BAD_REQUEST, error, INTERNAL_SERVER_ERROR, json, NOT_FOUND } from './response';

describe('response utilities', () => {
  describe('json()', () => {
    it('creates a Response with stringified JSON body', async () => {
      const data = { foo: 'bar' };
      const response = json(data);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      // Verify the body was properly stringified
      const body = await response.text();
      const parsed = superjson.parse(body);
      expect(parsed).toEqual(data);
    });

    it('accepts additional response options', () => {
      const response = json({ foo: 'bar' }, { status: 201 });
      expect(response.status).toBe(201);
    });
  });

  describe('error()', () => {
    it('creates an error response with string message', async () => {
      const response = error('Something went wrong');
      expect(response.status).toBe(500);

      const body = await response.text();
      const parsed = superjson.parse(body);
      expect(parsed).toEqual({ error: 'Something went wrong' });
    });

    it('creates an error response with object message', async () => {
      const errorObj = { code: 'INVALID_INPUT', message: 'Invalid data' };
      const response = error(errorObj, 400);
      expect(response.status).toBe(400);

      const body = await response.text();
      const parsed = superjson.parse(body);
      expect(parsed).toEqual({ error: errorObj });
    });
  });

  describe('predefined responses', () => {
    it('NOT_FOUND returns 404 response', async () => {
      expect(NOT_FOUND.status).toBe(404);
      const body = await NOT_FOUND.text();
      const parsed = superjson.parse(body);
      expect(parsed).toEqual({ error: 'Not found' });
    });

    it('BAD_REQUEST returns 400 response', async () => {
      expect(BAD_REQUEST.status).toBe(400);
      const body = await BAD_REQUEST.text();
      const parsed = superjson.parse(body);
      expect(parsed).toEqual({ error: 'Bad request' });
    });

    it('INTERNAL_SERVER_ERROR returns 500 response', async () => {
      expect(INTERNAL_SERVER_ERROR.status).toBe(500);
      const body = await INTERNAL_SERVER_ERROR.text();
      const parsed = superjson.parse(body);
      expect(parsed).toEqual({ error: 'Internal server error' });
    });
  });
});
