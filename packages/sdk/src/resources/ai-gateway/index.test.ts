import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../http-client';
import { AiGatewayResource } from './index';

const createMockHttpClient = (overrides: Partial<Record<string, unknown>> = {}): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
    postRaw: vi.fn().mockResolvedValue({}),
    requestStream: vi.fn(),
    ...overrides,
  }) as unknown as HttpClient;

const sseResponse = (text: string): Response => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(stream);
};

describe('AiGatewayResource', () => {
  it('uses the /ai/v1 base path for chat completions', async () => {
    const http = createMockHttpClient();
    const resource = new AiGatewayResource(http);
    const request = { model: 'openai/gpt-4o', messages: [{ role: 'user', content: 'Hello' }] };

    await resource.chatCompletions(request);
    expect(http.post).toHaveBeenCalledWith('/ai/v1/chat/completions', request, { headers: undefined });
  });

  it('lists models at /ai/v1/models', async () => {
    const http = createMockHttpClient();
    await new AiGatewayResource(http).listModels();
    expect(http.get).toHaveBeenCalledWith('/ai/v1/models');
  });

  it('URL-encodes the model id', async () => {
    const http = createMockHttpClient();
    await new AiGatewayResource(http).getModel('openai/gpt-4o');
    expect(http.get).toHaveBeenCalledWith('/ai/v1/models/openai%2Fgpt-4o');
  });

  it('streams chat completion chunks with stream:true', async () => {
    const chunk =
      'data: {"id":"1","object":"chat.completion.chunk","created":0,"model":"m","choices":[{"index":0,"delta":{"content":"hi"},"finish_reason":null}]}\n\n';
    const requestStream = vi.fn().mockResolvedValue(sseResponse(`${chunk}data: [DONE]\n\n`));
    const http = createMockHttpClient({ requestStream });
    const resource = new AiGatewayResource(http);

    const received: string[] = [];
    for await (const c of resource.chatCompletionsStream({ model: 'm', messages: [] })) {
      received.push(c.choices[0]?.delta.content ?? '');
    }

    expect(received).toEqual(['hi']);
    expect(requestStream).toHaveBeenCalledWith(
      'POST',
      '/ai/v1/chat/completions',
      expect.objectContaining({ body: expect.objectContaining({ stream: true }) })
    );
  });

  it('returns audio bytes for speech', async () => {
    const requestStream = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const http = createMockHttpClient({ requestStream });
    const buffer = await new AiGatewayResource(http).audio.speech({ model: 'tts', input: 'hi', voice: 'v' });
    expect(buffer.byteLength).toBe(3);
  });

  it('generates videos at /ai/v1/videos', async () => {
    const http = createMockHttpClient();
    await new AiGatewayResource(http).videos.generations({ model: 'veo', prompt: 'a cat' });
    expect(http.post).toHaveBeenCalledWith('/ai/v1/videos', { model: 'veo', prompt: 'a cat' }, { headers: undefined });
  });

  it('lists video models at /ai/v1/videos/models', async () => {
    const http = createMockHttpClient();
    await new AiGatewayResource(http).videos.listModels();
    expect(http.get).toHaveBeenCalledWith('/ai/v1/videos/models');
  });

  it('posts transcriptions as multipart form data', async () => {
    const http = createMockHttpClient();
    await new AiGatewayResource(http).audio.transcriptions({
      model: 'whisper',
      file: new Uint8Array([1]),
      language: 'en',
    });
    const [path, form] = (http.postRaw as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe('/ai/v1/audio/transcriptions');
    expect(form).toBeInstanceOf(FormData);
  });
});
