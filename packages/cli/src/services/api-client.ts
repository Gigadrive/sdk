import { ApiError, GigadriveClient } from '@gigadrive/sdk';
import { Config, Effect, Option, Redacted } from 'effect';
import { ApiRequestError } from '../errors';
import { AuthService } from './auth';

// ---------------------------------------------------------------------------
// ApiClientService
//
// A single, shared factory for the `@gigadrive/sdk` client. Every command that
// talks to the Gigadrive Network API obtains its client here so authentication
// (a fresh access token from AuthService) and the base URL are configured in
// exactly one place.
// ---------------------------------------------------------------------------

const ApiBaseUrl = Config.string('GIGADRIVE_API_BASE_URL').pipe(Config.withDefault('https://api.gigadrive.network'));
const ServiceCredentials = Config.all({
  bearerToken: Config.redacted('GIGADRIVE_BEARER_TOKEN').pipe(Config.option),
  clientId: Config.string('GIGADRIVE_CLIENT_ID').pipe(Config.option),
  clientSecret: Config.redacted('GIGADRIVE_CLIENT_SECRET').pipe(Config.option),
  refreshToken: Config.redacted('GIGADRIVE_REFRESH_TOKEN').pipe(Config.option),
});

/** Map any error thrown by an SDK call into a tagged {@link ApiRequestError}. */
const toApiRequestError = (error: unknown): ApiRequestError => {
  if (error instanceof ApiError) {
    return new ApiRequestError({ message: error.message, statusCode: error.status, code: error.code });
  }
  return new ApiRequestError({ message: error instanceof Error ? error.message : String(error) });
};

export class ApiClientService extends Effect.Service<ApiClientService>()('ApiClientService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const baseUrl = yield* ApiBaseUrl;
    const serviceCredentials = yield* ServiceCredentials;
    const authService = yield* AuthService;
    const hasServiceCredentials =
      Option.isSome(serviceCredentials.bearerToken) ||
      Option.isSome(serviceCredentials.clientId) ||
      Option.isSome(serviceCredentials.clientSecret) ||
      Option.isSome(serviceCredentials.refreshToken);

    /**
     * Build a `GigadriveClient` authenticated with a fresh access token.
     * Fails with `NotAuthenticatedError` when the user is not logged in.
     */
    const getClient = hasServiceCredentials
      ? Effect.succeed(
          new GigadriveClient({
            baseUrl,
            bearerToken: Option.map(serviceCredentials.bearerToken, Redacted.value).pipe(Option.getOrUndefined),
            clientId: Option.getOrUndefined(serviceCredentials.clientId),
            clientSecret: Option.map(serviceCredentials.clientSecret, Redacted.value).pipe(Option.getOrUndefined),
            refreshToken: Option.map(serviceCredentials.refreshToken, Redacted.value).pipe(Option.getOrUndefined),
          })
        )
      : Effect.gen(function* () {
          const token = yield* authService.getAccessToken;
          return new GigadriveClient({ bearerToken: token, baseUrl });
        });

    /**
     * Run an SDK call against an authenticated client, translating rejected
     * promises into a tagged {@link ApiRequestError}. This is the ergonomic
     * entry point for command handlers.
     *
     * @example
     * ```ts
     * const { items } = yield* apiClient.request((client) => client.applications.list());
     * ```
     */
    const request = <A>(f: (client: GigadriveClient) => Promise<A>) =>
      Effect.gen(function* () {
        const client = yield* getClient;
        return yield* Effect.tryPromise({
          try: () => f(client),
          catch: toApiRequestError,
        });
      });

    return { getClient, request };
  }),
}) {}
