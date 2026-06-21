import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenManager } from './auth/token-manager';
import { ApiError, AuthenticationError } from './errors';
import { HttpClient } from './http-client';

const createMockTokenManager = (): TokenManager =>
  ({
    getToken: vi.fn().mockResolvedValue('test-token'),
    invalidate: vi.fn(),
  }) as unknown as TokenManager;

const mockFetch = vi.fn<typeof globalThis.fetch>();

const createClient = (tokenManager?: TokenManager) =>
  new HttpClient('https://api.example.com', tokenManager ?? createMockTokenManager(), mockFetch);

describe('HttpClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should send GET request with auth header', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: '1' }), { status: 200 }));

    const client = createClient();
    const result = await client.get<{ id: string }>('/things/1');

    expect(result).toEqual({ id: '1' });
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/things/1', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-token' },
      body: null,
    });
  });

  it('should send POST request with JSON body', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: '2' }), { status: 201 }));

    const client = createClient();
    await client.post('/things', { name: 'test' });

    const call = mockFetch.mock.calls[0]!;
    expect(call[1]?.method).toBe('POST');
    expect(call[1]?.body).toBe(JSON.stringify({ name: 'test' }));
    expect((call[1]?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('should send PATCH request', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: '1' }), { status: 200 }));

    const client = createClient();
    await client.patch('/things/1', { name: 'updated' });

    expect(mockFetch.mock.calls[0]![1]?.method).toBe('PATCH');
  });

  it('should send DELETE request', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = createClient();
    await client.delete('/things/1');

    expect(mockFetch.mock.calls[0]![1]?.method).toBe('DELETE');
  });

  it('should handle 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = createClient();
    const result = await client.delete('/things/1');

    expect(result).toBeUndefined();
  });

  it('should serialize query parameters', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const client = createClient();
    await client.get('/things', { query: { status: 'active', type: undefined } });

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toBe('https://api.example.com/things?status=active');
  });

  it('should throw ApiError on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }));

    const client = createClient();

    await expect(client.get('/missing')).rejects.toThrow(ApiError);

    try {
      await client.get('/missing');
    } catch (e) {
      // won't reach here because of the first call, but structure is correct
    }
  });

  it('should retry once on 401 and succeed', async () => {
    const tokenManager = createMockTokenManager();
    (tokenManager.getToken as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('fresh-token');

    mockFetch
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const client = new HttpClient('https://api.example.com', tokenManager, mockFetch);
    const result = await client.get<{ ok: boolean }>('/protected');

    expect(result).toEqual({ ok: true });
    expect(tokenManager.invalidate).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should throw AuthenticationError on 401 after retry', async () => {
    const tokenManager = createMockTokenManager();

    mockFetch
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const client = new HttpClient('https://api.example.com', tokenManager, mockFetch);

    await expect(client.get('/protected')).rejects.toThrow(AuthenticationError);
  });

  it('should parse error response with string error', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Something went wrong' }), { status: 500 }));

    const client = createClient();

    try {
      await client.get('/fail');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toBe('Something went wrong');
      expect((e as ApiError).status).toBe(500);
    }
  });

  it('should parse error response with object error and code', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Bad input', code: 'invalid' } }), { status: 422 })
    );

    const client = createClient();

    await expect(client.get('/fail')).rejects.toMatchObject({ message: 'Bad input', status: 422, code: 'invalid' });
  });

  it('should send PUT request with JSON body', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const client = createClient();
    await client.put('/things/1', { name: 'x' });

    expect(mockFetch.mock.calls[0]![1]?.method).toBe('PUT');
    expect(mockFetch.mock.calls[0]![1]?.body).toBe(JSON.stringify({ name: 'x' }));
  });

  it('should pass custom headers alongside a JSON body', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    const client = createClient();
    await client.post('/things', { a: 1 }, { headers: { 'X-Custom': 'yes' } });

    const headers = mockFetch.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers['X-Custom']).toBe('yes');
    expect(headers['Content-Type']).toBe('application/json');
    expect(mockFetch.mock.calls[0]![1]?.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('should send a raw FormData body without forcing a JSON content-type', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    const client = createClient();
    const form = new FormData();
    form.set('a', 'b');
    await client.postRaw('/upload', form);

    const init = mockFetch.mock.calls[0]![1]!;
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('requestStream returns the raw response on success', async () => {
    const response = new Response('hello', { status: 200 });
    mockFetch.mockResolvedValueOnce(response);

    const client = createClient();
    const result = await client.requestStream('GET', '/stream');

    expect(result).toBe(response);
  });

  it('requestStream throws ApiError on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }));

    const client = createClient();
    await expect(client.requestStream('GET', '/stream')).rejects.toThrow(ApiError);
  });

  it('does not retry a one-shot ReadableStream body on 401', async () => {
    const tokenManager = createMockTokenManager();
    mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const client = new HttpClient('https://api.example.com', tokenManager, mockFetch);
    const body = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    await expect(client.postRaw('/upload', body)).rejects.toThrow(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
