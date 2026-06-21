import type { HttpClient, Paginated } from '../http-client';
import { BaseResource } from './base-resource';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One bucket of an AI Gateway usage breakdown (by model, provider, or user). */
export interface AiGatewayUsageBreakdown {
  /** Bucket label (a model, provider, or user identifier). */
  label: string;
  /** Number of requests in this bucket. */
  requests: number;
  /** Total tokens in this bucket. */
  tokens: number;
  /** Input tokens in this bucket. */
  inputTokens: number;
  /** Output tokens in this bucket. */
  outputTokens: number;
  /** Billable cost in micros of USD for this bucket. */
  costMicros: number;
}

/** Aggregated AI Gateway usage over a time range, with breakdowns. */
export interface AiGatewayUsageSummary {
  summary: {
    requestCount: number;
    successCount: number;
    errorCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    billableCostMicros: number;
    avgLatencyMs: number;
  };
  byModel: AiGatewayUsageBreakdown[];
  byProvider: AiGatewayUsageBreakdown[];
  byUser: AiGatewayUsageBreakdown[];
}

/** One provider attempt recorded while routing an AI Gateway request. */
export interface AiGatewayProviderAttempt {
  provider: string;
  error?: string;
  statusCode?: number;
  tag?: string;
}

/** A single AI Gateway request event with full telemetry. */
export interface AiGatewayRequestEvent {
  id: string;
  requestId: string;
  traceId: string | null;
  billingSubjectType: 'organization' | 'application';
  organizationId: string;
  applicationId: string | null;
  actorId: string | null;
  actorType: string;
  apiKeyId: string | null;
  authenticatedUserId: string | null;
  callerEndUserId: string | null;
  modelRequested: string;
  modelServed: string | null;
  provider: string | null;
  providerAttempts: AiGatewayProviderAttempt[] | null;
  status: 'pending' | 'success' | 'error' | 'cancelled';
  errorCode: string | null;
  errorType: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
  usageSource: 'provider' | 'estimated' | 'none';
  providerCostMicros: number;
  billableCostMicros: number;
  streaming: boolean;
  latencyMs: number | null;
  metadata: Record<string, string> | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An AI Gateway spend/usage budget. */
export interface AiGatewayBudget {
  id: string;
  organizationId: string;
  /** Application-specific target, or `null` for organization-wide. */
  applicationId: string | null;
  /** User-specific target, or `null` for all users. */
  userId: string | null;
  period: 'day' | 'month';
  maxCostMicros: number | null;
  maxRequests: number | null;
  maxTokens: number | null;
  maxRequestCostMicros: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Input for one budget when replacing the budget set. */
export interface AiGatewayBudgetInput {
  applicationId?: string;
  userId?: string;
  period?: 'day' | 'month';
  maxCostMicros?: number | null;
  maxRequests?: number | null;
  maxTokens?: number | null;
  maxRequestCostMicros?: number | null;
  enabled?: boolean;
}

/** An AI Gateway governance policy. */
export interface AiGatewayPolicy {
  id: string;
  organizationId: string;
  /** Application-specific target, or `null` for organization-wide. */
  applicationId: string | null;
  /** Allowed model IDs, or `null` to allow all. */
  allowedModels: string[] | null;
  /** Allowed provider IDs, or `null` to allow all. */
  allowedProviders: string[] | null;
  requireZdr: boolean;
  allowFallbacks: boolean;
  maxOutputTokens: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating or updating an AI Gateway policy. */
export interface AiGatewayPolicyInput {
  applicationId?: string;
  allowedModels?: string[] | null;
  allowedProviders?: string[] | null;
  requireZdr?: boolean;
  allowFallbacks?: boolean;
  maxOutputTokens?: number | null;
}

/** Query for usage summary. */
export interface AiGatewayUsageQuery {
  /** Only include usage at or after this ISO 8601 timestamp. */
  from?: string;
  /** Only include usage before or at this ISO 8601 timestamp. */
  to?: string;
  /** Restrict to one application. */
  applicationId?: string;
}

/** Query for the request-event log and CSV export. */
export interface AiGatewayRequestsQuery extends AiGatewayUsageQuery {
  model?: string;
  provider?: string;
  status?: 'pending' | 'success' | 'error' | 'cancelled';
  requestId?: string;
  authenticatedUserId?: string;
  callerEndUserId?: string;
  limit?: number;
  cursor?: string;
}

// ---------------------------------------------------------------------------
// Sub-resources
// ---------------------------------------------------------------------------

/** AI Gateway usage analytics for an organization. */
export class AiGatewayUsageResource extends BaseResource {
  /** Get an aggregated usage summary with breakdowns by model, provider, and user. */
  async summary(organizationId: string, query?: AiGatewayUsageQuery): Promise<AiGatewayUsageSummary> {
    return this.httpClient.get(`/organizations/${organizationId}/ai-gateway/usage/summary`, {
      query: query as Record<string, string | undefined> | undefined,
    });
  }

  /** List request-level usage events. */
  async requests(organizationId: string, query?: AiGatewayRequestsQuery): Promise<Paginated<AiGatewayRequestEvent>> {
    return this.httpClient.get(`/organizations/${organizationId}/ai-gateway/usage/requests`, {
      query: query as Record<string, string | number | undefined> | undefined,
    });
  }

  /** Export request-level usage events as CSV text. */
  async export(organizationId: string, query?: AiGatewayRequestsQuery): Promise<string> {
    const response = await this.httpClient.requestStream(
      'GET',
      `/organizations/${organizationId}/ai-gateway/usage/export`,
      { query: query as Record<string, string | number | undefined> | undefined }
    );
    return response.text();
  }
}

/** AI Gateway budgets for an organization. */
export class AiGatewayBudgetsResource extends BaseResource {
  /** List all budgets for an organization. */
  async list(organizationId: string): Promise<{ items: AiGatewayBudget[] }> {
    return this.httpClient.get(`/organizations/${organizationId}/ai-gateway/budgets`);
  }

  /**
   * Replace the organization's entire budget set. Pass an empty array to clear
   * all budgets.
   */
  async replace(organizationId: string, budgets: AiGatewayBudgetInput[]): Promise<{ items: AiGatewayBudget[] }> {
    return this.httpClient.put(`/organizations/${organizationId}/ai-gateway/budgets`, { budgets });
  }
}

/** AI Gateway governance policies for an organization. */
export class AiGatewayPoliciesResource extends BaseResource {
  /**
   * Get the governance policy for an organization, or for a specific
   * application when `applicationId` is provided. Returns `null` if no policy is set.
   */
  async get(organizationId: string, options?: { applicationId?: string }): Promise<AiGatewayPolicy | null> {
    const { policy } = await this.httpClient.get<{ policy: AiGatewayPolicy | null }>(
      `/organizations/${organizationId}/ai-gateway/policies`,
      { query: { applicationId: options?.applicationId } }
    );
    return policy;
  }

  /** Create or update an AI Gateway policy. */
  async put(organizationId: string, data: AiGatewayPolicyInput): Promise<AiGatewayPolicy> {
    const { policy } = await this.httpClient.put<{ policy: AiGatewayPolicy }>(
      `/organizations/${organizationId}/ai-gateway/policies`,
      data
    );
    return policy;
  }
}

/**
 * Organization-scoped AI Gateway governance: usage analytics, budgets, and
 * model/provider policies. Accessed via `client.organizations.aiGateway`.
 */
export class OrganizationAiGatewayResource {
  /** Usage analytics (summary, request log, CSV export). */
  readonly usage: AiGatewayUsageResource;
  /** Spend/usage budgets. */
  readonly budgets: AiGatewayBudgetsResource;
  /** Model/provider governance policies. */
  readonly policies: AiGatewayPoliciesResource;

  constructor(httpClient: HttpClient) {
    this.usage = new AiGatewayUsageResource(httpClient);
    this.budgets = new AiGatewayBudgetsResource(httpClient);
    this.policies = new AiGatewayPoliciesResource(httpClient);
  }
}
