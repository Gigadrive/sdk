/**
 * Types for the AI Gateway runtime endpoints (`/ai/v1`). The chat/responses
 * shapes are OpenAI-compatible; additional fields are passed through, so request
 * types include an index signature and responses surface the common fields.
 */

/** Provider routing preferences accepted by inference endpoints. */
export interface ProviderRouting {
  /** Preferred provider order (e.g. `["openai", "anthropic"]`). */
  order?: string[];
  /** Whether the gateway may fall back to other providers. */
  allow_fallbacks?: boolean;
  /** Require zero-data-retention capable routing. */
  require_zdr?: boolean;
  /** Restrict routing to exactly the providers in `order`. */
  restrict_to_order?: boolean;
}

/** A text or multi-part content part in a chat message. */
export type ChatCompletionContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'file'; file: { filename?: string; file_data?: string; file_id?: string } };

/** A message in a chat completion request or response. */
export interface ChatCompletionMessage {
  /** The role of the message author (e.g. `"system"`, `"user"`, `"assistant"`). */
  role: string;
  /** The message content — plain text or an array of content parts. */
  content: string | ChatCompletionContentPart[] | null;
  /** Additional OpenAI-compatible fields (e.g. `tool_calls`) are passed through. */
  [key: string]: unknown;
}

/** Request for an OpenAI-compatible chat completion. */
export interface ChatCompletionRequest {
  /** The model ID (e.g. `"openai/gpt-4o"`). */
  model: string;
  /** The conversation messages. */
  messages: ChatCompletionMessage[];
  /** Sampling temperature (0–2). */
  temperature?: number;
  /** Nucleus sampling parameter (0–1). */
  top_p?: number;
  /** Maximum number of tokens to generate. */
  max_tokens?: number;
  /** Whether to stream the response. Prefer {@link AiGatewayResource.chatCompletionsStream}. */
  stream?: boolean;
  /** Tool/function definitions. */
  tools?: unknown[];
  /** Tool choice strategy. */
  tool_choice?: unknown;
  /** Provider routing preferences. */
  provider?: ProviderRouting;
  /** Additional OpenAI-compatible parameters are passed through. */
  [key: string]: unknown;
}

/** Token usage statistics. */
export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** A single completion choice. */
export interface ChatCompletionChoice {
  index: number;
  message: ChatCompletionMessage;
  finish_reason: string | null;
}

/** Response from an OpenAI-compatible chat completion. */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
  system_fingerprint?: string;
  /** Estimated cost of the request in micros of USD, when available. */
  cost_micros?: number;
  [key: string]: unknown;
}

/** A streamed chat completion chunk (`stream: true`). */
export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string | null; [key: string]: unknown };
    finish_reason: string | null;
  }>;
  [key: string]: unknown;
}

/** Request for the Open Responses-compatible endpoint. */
export interface ResponsesRequest {
  model: string;
  /** Provider routing preferences. */
  provider?: ProviderRouting;
  /** Whether to stream the response. */
  stream?: boolean;
  /** Additional Responses-compatible parameters are passed through. */
  [key: string]: unknown;
}

/** Response from the Open Responses-compatible endpoint. */
export interface ResponsesResponse {
  id: string;
  object: string;
  status: string;
  [key: string]: unknown;
}

/** Capability flags for an AI model. */
export interface AiModelCapabilities {
  chat: boolean;
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  json_mode: boolean;
}

/** Display metadata for a routing provider that can serve a model. */
export interface AiModelRoutingProvider {
  id: string;
  name: string;
  logoUrl?: string;
  supportsZdr: boolean;
}

/** An AI model available through the gateway. */
export interface AiModel {
  /** Model identifier to pass to inference endpoints (e.g. `"openai/gpt-4o"`). */
  id: string;
  /** Human-readable model name. */
  name: string;
  /** Primary provider family/owner. */
  provider: string;
  /** Logo URL for the primary provider, if available. */
  providerLogoUrl?: string;
  /** Capability flags. */
  capabilities: AiModelCapabilities;
  /** Supported input/output modalities, if declared. */
  modalities?: { input: string[]; output: string[] };
  /** Maximum combined input+output context window in tokens. */
  contextWindow: number;
  /** Maximum output tokens the gateway will request. */
  maxOutputTokens: number;
  /** Product-facing model summary, if configured. */
  description?: string;
  /** Provider route IDs that can serve this model. */
  routingProviders: string[];
  /** Display metadata for each routing provider. */
  routingProviderDetails: AiModelRoutingProvider[];
  /** Provider route IDs that support zero-data-retention. */
  zdrProviders: string[];
}

/** Request for text-to-speech synthesis. */
export interface SpeechRequest {
  model: string;
  /** The text to synthesize. */
  input: string;
  /** The voice to use. */
  voice: string;
  /** Output audio format. */
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  /** Playback speed (0.25–4.0). */
  speed?: number;
  /** Provider routing preferences. */
  provider?: ProviderRouting;
  [key: string]: unknown;
}

/** Request for speech-to-text transcription. */
export interface TranscriptionRequest {
  model: string;
  /** The audio file to transcribe. */
  file: Blob | Uint8Array | ArrayBuffer;
  /** Filename to send with the file part. */
  filename?: string;
  /** Spoken language hint (ISO-639-1). */
  language?: string;
  /** Optional prompt to guide transcription. */
  prompt?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Response format. */
  response_format?: string;
  /** Additional fields are appended to the multipart form. */
  [key: string]: unknown;
}

/** Response from a transcription request. */
export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: unknown[];
  [key: string]: unknown;
}

/** Request for video generation. */
export interface VideoGenerationRequest {
  model: string;
  prompt: string;
  duration?: number;
  resolution?: string;
  fps?: number;
  provider?: ProviderRouting;
  [key: string]: unknown;
}

/** Response from a video generation request. */
export interface VideoGenerationResponse {
  id: string;
  status: string;
  video?: { url: string; duration?: number };
  created_at?: number;
  expires_at?: number;
  [key: string]: unknown;
}

/** Response from listing video models. */
export interface VideoModelList {
  object: string;
  data: Array<Record<string, unknown>>;
}

/** Per-request options for gateway calls (custom headers such as `X-Gigadrive-*`). */
export interface GatewayRequestOptions {
  /** Additional request headers (e.g. `X-Gigadrive-Application-Id`, `X-Gigadrive-End-User-Id`). */
  headers?: Record<string, string>;
}

/** A gateway result paired with its raw response and surfaced metadata headers. */
export interface GatewayResult<T> {
  /** The parsed response body. */
  data: T;
  /** The raw `Response`, for reading additional headers. */
  response: Response;
  /** The `X-Gigadrive-Request-Id` header, if present. */
  requestId?: string;
  /** The `X-Gigadrive-Cost-Micros` header parsed as a number, if present. */
  costMicros?: number;
}
