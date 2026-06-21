import type { HttpClient, Paginated } from '../../http-client';
import { parseSSEStream } from '../../streaming';
import { BaseResource } from '../base-resource';
import type {
  AiModel,
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  GatewayRequestOptions,
  GatewayResult,
  ResponsesRequest,
  ResponsesResponse,
  SpeechRequest,
  TranscriptionRequest,
  TranscriptionResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoModelList,
} from './types';

export type * from './types';

const BASE = '/ai/v1';

const toBlob = (file: Blob | Uint8Array | ArrayBuffer): Blob => {
  if (file instanceof Uint8Array) return new Blob([file]);
  if (typeof Blob !== 'undefined' && file instanceof Blob) return file;
  return new Blob([new Uint8Array(file as ArrayBuffer)]);
};

/** Text-to-speech and speech-to-text endpoints. */
export class AiGatewayAudioResource extends BaseResource {
  /**
   * Synthesize speech from text. Returns the raw audio bytes.
   *
   * @returns The audio content as an `ArrayBuffer` (format per `response_format`).
   */
  async speech(data: SpeechRequest, options?: GatewayRequestOptions): Promise<ArrayBuffer> {
    const response = await this.httpClient.requestStream('POST', `${BASE}/audio/speech`, {
      body: data,
      headers: options?.headers,
    });
    return response.arrayBuffer();
  }

  /**
   * Transcribe an audio file to text. The file is sent as multipart form data.
   */
  async transcriptions(data: TranscriptionRequest, options?: GatewayRequestOptions): Promise<TranscriptionResponse> {
    const form = new FormData();
    const { file, filename, ...rest } = data;
    form.set('file', toBlob(file), filename ?? 'audio');
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined || value === null) continue;
      form.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value as string | number | boolean));
    }
    return this.httpClient.postRaw(`${BASE}/audio/transcriptions`, form, options?.headers);
  }
}

/** Video generation endpoints. */
export class AiGatewayVideosResource extends BaseResource {
  /** Generate a video from a prompt. */
  async generations(data: VideoGenerationRequest, options?: GatewayRequestOptions): Promise<VideoGenerationResponse> {
    return this.httpClient.post(`${BASE}/videos`, data, { headers: options?.headers });
  }

  /** List the video models available through the gateway. */
  async listModels(): Promise<VideoModelList> {
    return this.httpClient.get(`${BASE}/videos/models`);
  }
}

/**
 * Interact with the Gigadrive AI Gateway — an OpenAI-compatible API that routes
 * requests to multiple AI providers. Accessed via {@link GigadriveClient.aiGateway}.
 *
 * @example
 * ```ts
 * // Chat completion
 * const res = await client.aiGateway.chatCompletions({
 *   model: 'openai/gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * console.log(res.choices[0].message.content);
 *
 * // Streamed chat completion
 * for await (const chunk of client.aiGateway.chatCompletionsStream({
 *   model: 'openai/gpt-4o',
 *   messages: [{ role: 'user', content: 'Write a haiku.' }],
 * })) {
 *   process.stdout.write(chunk.choices[0]?.delta.content ?? '');
 * }
 * ```
 */
export class AiGatewayResource extends BaseResource {
  /** Text-to-speech and speech-to-text. */
  readonly audio: AiGatewayAudioResource;
  /** Video generation. */
  readonly videos: AiGatewayVideosResource;

  constructor(httpClient: HttpClient) {
    super(httpClient);
    this.audio = new AiGatewayAudioResource(httpClient);
    this.videos = new AiGatewayVideosResource(httpClient);
  }

  /**
   * Create a chat completion using the OpenAI-compatible endpoint.
   *
   * @param data - The chat completion request (model, messages, options, provider routing).
   * @param options - Custom headers (e.g. `X-Gigadrive-Application-Id`).
   */
  async chatCompletions(data: ChatCompletionRequest, options?: GatewayRequestOptions): Promise<ChatCompletionResponse> {
    return this.httpClient.post(`${BASE}/chat/completions`, { ...data, stream: false }, { headers: options?.headers });
  }

  /**
   * Like {@link chatCompletions}, but also returns the raw response and the
   * gateway request-id / cost headers.
   */
  async chatCompletionsWithResponse(
    data: ChatCompletionRequest,
    options?: GatewayRequestOptions
  ): Promise<GatewayResult<ChatCompletionResponse>> {
    const response = await this.httpClient.requestStream('POST', `${BASE}/chat/completions`, {
      body: { ...data, stream: false },
      headers: options?.headers,
    });
    const body = (await response.json()) as ChatCompletionResponse;
    const cost = response.headers.get('X-Gigadrive-Cost-Micros');
    return {
      data: body,
      response,
      requestId: response.headers.get('X-Gigadrive-Request-Id') ?? undefined,
      costMicros: cost !== null ? Number(cost) : undefined,
    };
  }

  /**
   * Stream a chat completion as Server-Sent Events. Yields each chunk as it
   * arrives and ends when the gateway closes the stream.
   */
  async *chatCompletionsStream(
    data: ChatCompletionRequest,
    options?: GatewayRequestOptions
  ): AsyncGenerator<ChatCompletionChunk> {
    const response = await this.httpClient.requestStream('POST', `${BASE}/chat/completions`, {
      body: { ...data, stream: true },
      headers: options?.headers,
    });
    yield* parseSSEStream<ChatCompletionChunk>(response);
  }

  /**
   * Create a response using the Open Responses-compatible endpoint.
   */
  async responses(data: ResponsesRequest, options?: GatewayRequestOptions): Promise<ResponsesResponse> {
    return this.httpClient.post(`${BASE}/responses`, { ...data, stream: false }, { headers: options?.headers });
  }

  /**
   * Stream a response using the Open Responses-compatible endpoint.
   */
  async *responsesStream(data: ResponsesRequest, options?: GatewayRequestOptions): AsyncGenerator<unknown> {
    const response = await this.httpClient.requestStream('POST', `${BASE}/responses`, {
      body: { ...data, stream: true },
      headers: options?.headers,
    });
    yield* parseSSEStream(response);
  }

  /**
   * List all AI models available through the gateway.
   */
  async listModels(): Promise<Paginated<AiModel>> {
    return this.httpClient.get(`${BASE}/models`);
  }

  /**
   * Get details for a specific AI model by its ID.
   *
   * @param modelId - The model identifier (e.g. `"openai/gpt-4o"`).
   */
  async getModel(modelId: string): Promise<AiModel> {
    return this.httpClient.get(`${BASE}/models/${encodeURIComponent(modelId)}`);
  }
}
