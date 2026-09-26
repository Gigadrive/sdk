import type { CustomDomain, CustomDomainState, GigadriveClient } from '@gigadrive/sdk';
import { Console, Effect, Either, Fiber, Layer, Option, TestClock, TestContext } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../errors';
import { ApiClientService } from '../../services/api-client';
import { addDomain, errorMessage, findDomain, removeDomain, targetFromFlags, type TargetFlags } from './index';

const domain = (state: CustomDomainState, overrides: Partial<CustomDomain> = {}): CustomDomain => ({
  id: 'dom-1',
  applicationId: 'app-1',
  hostname: 'shop.example.com',
  unicodeHostname: 'shop.example.com',
  apex: 'example.com',
  isApex: false,
  state,
  suspendedReason: null,
  target: {
    type: 'production',
    branchId: null,
    redirectTo: null,
    redirectStatusCode: null,
    redirectPreservePath: true,
  },
  primary: false,
  ownership: { name: 'example.com', verified: true },
  requiredRecords: [
    {
      purpose: 'routing',
      type: 'CNAME',
      name: 'shop.example.com',
      host: 'shop',
      value: 'cname.example.net',
      status: 'pending',
    },
  ],
  error: null,
  certificate: { status: 'none', expiresAt: null },
  dns: null,
  nextCheckAt: null,
  activatedAt: null,
  createdAt: '2026-09-26T12:00:00.000Z',
  updatedAt: '2026-09-26T12:00:00.000Z',
  ...overrides,
});

/** Runs SDK calls against a stub client, mapping rejections like the real service does. */
const apiLayer = (client: unknown) =>
  Layer.succeed(ApiClientService, {
    request: <A>(run: (client: GigadriveClient) => Promise<A>) =>
      Effect.tryPromise({
        try: () => run(client as GigadriveClient),
        catch: (error) => (error instanceof ApiRequestError ? error : new ApiRequestError({ message: String(error) })),
      }),
  } as unknown as ApiClientService);

/** Captures stdout and stderr lines separately. */
const captureConsole = () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const console = {
    log: (...args: ReadonlyArray<unknown>) => Effect.sync(() => void stdout.push(args.join(' '))),
    error: (...args: ReadonlyArray<unknown>) => Effect.sync(() => void stderr.push(args.join(' '))),
  } as unknown as Console.Console;
  return { stdout, stderr, console };
};

const noFlags: TargetFlags = {
  production: false,
  branch: Option.none(),
  redirectTo: Option.none(),
  status: Option.none(),
  dropPath: false,
};

describe('targetFromFlags', () => {
  const run = (flags: Partial<TargetFlags>) => Effect.runSync(Effect.either(targetFromFlags({ ...noFlags, ...flags })));

  it('returns no target when no flag is given', () => {
    expect(run({})).toEqual(Either.right(undefined));
  });

  it('builds a redirect with the chosen status and path handling', () => {
    expect(run({ redirectTo: Option.some('www.example.com'), status: Option.some('301'), dropPath: true })).toEqual(
      Either.right({ type: 'redirect', to: 'www.example.com', statusCode: 301, preservePath: false })
    );
  });

  it('refuses a branch and a redirect together instead of picking one', () => {
    const result = run({ branch: Option.some('branch-1'), redirectTo: Option.some('www.example.com') });
    expect(Either.isLeft(result) && result.left._tag).toBe('InvalidDomainOptionsError');
  });

  it('refuses --status and --drop-path without --redirect-to', () => {
    expect(Either.isLeft(run({ status: Option.some('302') }))).toBe(true);
    expect(Either.isLeft(run({ dropPath: true }))).toBe(true);
  });
});

describe('errorMessage', () => {
  const apiError = (code: string, reason?: string) => ({
    _tag: 'ApiRequestError',
    message: 'Request refused.',
    code,
    reason,
  });

  it('explains the daily add limit instead of pointing at plan limits', () => {
    expect(errorMessage('add the domain', apiError('quota_exceeded', 'daily_add_limit'))).toContain('24 hours');
  });

  it('links to the console for plan quotas', () => {
    expect(errorMessage('add the domain', apiError('quota_exceeded'))).toContain('https://console.gigadrive.de');
  });

  it('says redirects need a paid plan', () => {
    expect(errorMessage('add the domain', apiError('invalid_target', 'redirects_not_available'))).toContain(
      'paid plans'
    );
  });

  it('points at the claim flow for a hostname another organization holds', () => {
    expect(errorMessage('add the domain', apiError('domain_in_use', 'other_organization'))).toContain(
      'gigadrive domains claim'
    );
  });
});

describe('findDomain', () => {
  it('matches the hostname regardless of case and a trailing dot', async () => {
    const client = { applications: { domains: { list: vi.fn().mockResolvedValue({ items: [domain('active')] }) } } };

    const found = await findDomain('app-1', 'Shop.Example.COM.').pipe(
      Effect.provide(apiLayer(client)),
      Effect.runPromise
    );

    expect(found.id).toBe('dom-1');
  });
});

describe('addDomain', () => {
  const input = {
    ...noFlags,
    hostname: 'shop.example.com',
    applicationId: 'app-1',
    wait: true,
    timeout: 10,
    json: true,
  };

  const runWithClock = <A, E>(effect: Effect.Effect<A, E, ApiClientService>, client: unknown, advance: string) => {
    const output = captureConsole();
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.fork(Effect.either(effect));
      yield* TestClock.adjust(advance);
      return yield* Fiber.join(fiber);
    }).pipe(
      Effect.withConsole(output.console),
      Effect.provide(apiLayer(client)),
      Effect.provide(TestContext.TestContext)
    );
    return Effect.runPromise(program).then((result) => ({ result, ...output }));
  };

  it('prints only one JSON document on stdout with --json --wait, progress goes to stderr', async () => {
    const client = {
      applications: {
        domains: {
          add: vi.fn().mockResolvedValue(domain('pending_dns')),
          get: vi.fn().mockResolvedValueOnce(domain('issuing_certificate')).mockResolvedValueOnce(domain('active')),
        },
      },
    };

    const { result, stdout, stderr } = await runWithClock(addDomain(input), client, '1 minute');

    expect(Either.isRight(result)).toBe(true);
    expect(stdout).toHaveLength(1);
    expect(JSON.parse(stdout[0])).toMatchObject({ state: 'active' });
    expect(stderr.join('\n')).toContain('Waiting for shop.example.com');
  });

  it('still prints the last known domain as JSON when the wait fails', async () => {
    const client = {
      applications: {
        domains: {
          add: vi.fn().mockResolvedValue(domain('pending_dns')),
          get: vi.fn().mockResolvedValue(domain('failed', { error: { code: 'cert_blocked_caa', message: 'CAA' } })),
        },
      },
    };

    const { result, stdout } = await runWithClock(addDomain(input), client, '1 minute');

    expect(Either.isLeft(result) && result.left._tag).toBe('DomainWaitError');
    expect(stdout).toHaveLength(1);
    expect(JSON.parse(stdout[0])).toMatchObject({ state: 'failed' });
  });

  it('keeps waiting through a transient API failure', async () => {
    const client = {
      applications: {
        domains: {
          add: vi.fn().mockResolvedValue(domain('pending_dns')),
          get: vi
            .fn()
            .mockRejectedValueOnce(new ApiRequestError({ message: 'Bad gateway', statusCode: 502 }))
            .mockResolvedValueOnce(domain('active')),
        },
      },
    };

    const { result } = await runWithClock(addDomain(input), client, '1 minute');

    expect(Either.isRight(result)).toBe(true);
    expect(client.applications.domains.get).toHaveBeenCalledTimes(2);
  });

  it('stops at the deadline with a wait error', async () => {
    const client = {
      applications: {
        domains: {
          add: vi.fn().mockResolvedValue(domain('pending_dns')),
          get: vi.fn().mockResolvedValue(domain('pending_dns')),
        },
      },
    };

    const { result } = await runWithClock(addDomain({ ...input, timeout: 1 }), client, '2 minutes');

    expect(Either.isLeft(result) && result.left._tag).toBe('DomainWaitError');
  });

  it('rejects a timeout below one minute before calling the API', async () => {
    const client = { applications: { domains: { add: vi.fn() } } };

    const { result } = await runWithClock(addDomain({ ...input, timeout: 0 }), client, '1 second');

    expect(Either.isLeft(result) && result.left._tag).toBe('InvalidDomainOptionsError');
    expect(client.applications.domains.add).not.toHaveBeenCalled();
  });
});

describe('removeDomain', () => {
  const isTTY = process.stdin.isTTY;
  afterEach(() => {
    process.stdin.isTTY = isTTY;
  });

  const client = () => ({
    applications: {
      domains: {
        list: vi.fn().mockResolvedValue({ items: [domain('active')] }),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
  });

  it('fails fast without a terminal instead of waiting on a prompt nobody can answer', async () => {
    process.stdin.isTTY = false;
    const stub = client();

    const result = await removeDomain('app-1', 'shop.example.com', false).pipe(
      Effect.either,
      Effect.withConsole(captureConsole().console),
      Effect.provide(apiLayer(stub)),
      Effect.runPromise
    );

    expect(Either.isLeft(result) && result.left._tag).toBe('ConfirmationRequiredError');
    expect(stub.applications.domains.remove).not.toHaveBeenCalled();
  });

  it('removes without asking when --yes is passed', async () => {
    process.stdin.isTTY = false;
    const stub = client();

    await removeDomain('app-1', 'shop.example.com', true).pipe(
      Effect.withConsole(captureConsole().console),
      Effect.provide(apiLayer(stub)),
      Effect.runPromise
    );

    expect(stub.applications.domains.remove).toHaveBeenCalledWith('app-1', 'dom-1');
  });
});
