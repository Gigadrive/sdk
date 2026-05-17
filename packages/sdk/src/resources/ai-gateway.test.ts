import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { AiGatewayResource } from './ai-gateway';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
  }) as unknown as HttpClient;

describe('AiGatewayResource', () => {
  it('should create chat completion', async () => {
    const http = createMockHttpClient();
    const resource = new AiGatewayResource(http);

    const request = { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] };
    await resource.chatCompletions(request);
    expect(http.post).toHaveBeenCalledWith('/v1/chat/completions', request);
  });

  it('should list models', async () => {
    const http = createMockHttpClient();
    const resource = new AiGatewayResource(http);

    await resource.listModels();
    expect(http.get).toHaveBeenCalledWith('/v1/models');
  });

  it('should get a model', async () => {
    const http = createMockHttpClient();
    const resource = new AiGatewayResource(http);

    await resource.getModel('gpt-4');
    expect(http.get).toHaveBeenCalledWith('/v1/models/gpt-4');
  });
});
