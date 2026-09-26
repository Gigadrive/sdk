import { Args, Command, Options, Prompt } from '@effect/cli';
import type { CustomDomain, CustomDomainTargetInput } from '@gigadrive/sdk';
import { Clock, Console, Duration, Effect, Either, Option } from 'effect';
import {
  ConfirmationRequiredError,
  DomainNotFoundError,
  DomainWaitError,
  InvalidDomainOptionsError,
  OrganizationRequiredError,
} from '../../errors';
import { describeDomain, DOMAIN_STATE_LABELS, formatDnsRecords, IN_PROGRESS_STATES } from '../../lib/domain-output';
import { ApiClientService } from '../../services/api-client';
import { ProjectLinkService } from '../../services/project-link';

const REDIRECT_STATUS_CODES = ['301', '302', '307', '308'] as const;
const CONSOLE_URL = 'https://console.gigadrive.de';
const POLL_INTERVAL = Duration.seconds(5);

const appOption = Options.text('app').pipe(
  Options.withAlias('a'),
  Options.withDescription('Operate on this application (overrides the linked application)'),
  Options.optional
);

const orgOption = Options.text('org').pipe(
  Options.withAlias('o'),
  Options.withDescription('Operate on this organization (defaults to the linked project’s organization)'),
  Options.optional
);

const jsonOption = Options.boolean('json').pipe(
  Options.withDescription('Print only the result as JSON on stdout; progress goes to stderr')
);

const waitOption = Options.boolean('wait').pipe(
  Options.withAlias('w'),
  Options.withDescription('Wait until the domain serves traffic, printing each state change')
);

const timeoutOption = Options.integer('timeout').pipe(
  Options.withDescription('Minutes to wait with --wait, at least 1 (default: 10)'),
  Options.withDefault(10)
);

const branchOption = Options.text('branch').pipe(
  Options.withDescription('Serve the latest deployment of this branch ID instead of production'),
  Options.optional
);

const productionOption = Options.boolean('production').pipe(
  Options.withDescription('Serve the production deployment (the default for new domains)')
);

const redirectToOption = Options.text('redirect-to').pipe(
  Options.withDescription('Redirect every request to this hostname instead of serving the application'),
  Options.optional
);

const statusOption = Options.choice('status', REDIRECT_STATUS_CODES).pipe(
  Options.withDescription('Redirect status code with --redirect-to (default: 308)'),
  Options.optional
);

const dropPathOption = Options.boolean('drop-path').pipe(
  Options.withDescription('With --redirect-to, redirect to the root instead of keeping the path and query')
);

const primaryOption = Options.boolean('primary').pipe(
  Options.withDescription('Make this domain the application’s primary URL')
);

const yesOption = Options.boolean('yes').pipe(
  Options.withAlias('y'),
  Options.withDescription('Skip the confirmation prompt (required when not running in a terminal)')
);

const hostnameArg = Args.text({ name: 'hostname' }).pipe(
  Args.withDescription('Hostname to attach, e.g. shop.example.com or example.com')
);

const domainArg = Args.text({ name: 'hostname-or-id' }).pipe(Args.withDescription('Domain hostname or ID'));

/** Target flags shared by `add` and `update`. */
export interface TargetFlags {
  readonly production: boolean;
  readonly branch: Option.Option<string>;
  readonly redirectTo: Option.Option<string>;
  readonly status: Option.Option<(typeof REDIRECT_STATUS_CODES)[number]>;
  readonly dropPath: boolean;
}

/**
 * Turns the target flags into the API's target, refusing combinations that contradict each other
 * instead of silently picking one.
 *
 * @returns The target, or `undefined` when no target flag was given.
 */
export const targetFromFlags = (flags: TargetFlags) =>
  Effect.gen(function* () {
    const chosen = [flags.production, Option.isSome(flags.branch), Option.isSome(flags.redirectTo)].filter(Boolean);
    if (chosen.length > 1) {
      return yield* new InvalidDomainOptionsError({
        message: 'Choose one target: --production, --branch or --redirect-to.',
      });
    }
    if (Option.isNone(flags.redirectTo) && (Option.isSome(flags.status) || flags.dropPath)) {
      return yield* new InvalidDomainOptionsError({
        message: '--status and --drop-path only apply together with --redirect-to.',
      });
    }
    if (Option.isSome(flags.redirectTo)) {
      const target: CustomDomainTargetInput = {
        type: 'redirect',
        to: flags.redirectTo.value,
        statusCode: Option.match(flags.status, {
          onNone: () => undefined,
          onSome: (code) => (code === '301' ? 301 : code === '302' ? 302 : code === '307' ? 307 : 308),
        }),
        preservePath: !flags.dropPath,
      };
      return target;
    }
    if (Option.isSome(flags.branch)) {
      const target: CustomDomainTargetInput = { type: 'branch', branchId: flags.branch.value };
      return target;
    }
    if (flags.production) {
      const target: CustomDomainTargetInput = { type: 'production' };
      return target;
    }
    return undefined;
  });

const requirePositiveTimeout = (minutes: number) =>
  minutes >= 1
    ? Effect.succeed(minutes)
    : new InvalidDomainOptionsError({ message: '--timeout must be at least 1 minute.' });

/** Asks before a destructive action. Without a terminal there is nobody to ask, so `--yes` is required. */
const confirm = (message: string, yes: boolean) =>
  Effect.gen(function* () {
    if (yes) return true;
    if (process.stdin.isTTY !== true) {
      return yield* new ConfirmationRequiredError({
        message: 'Not running in a terminal, so there is no way to confirm. Pass --yes to proceed.',
      });
    }
    return yield* Prompt.run(Prompt.confirm({ message, initial: false }));
  });

const resolveApplication = (app: Option.Option<string>) =>
  Option.match(app, {
    onSome: (value) => Effect.succeed(value),
    onNone: () =>
      Effect.gen(function* () {
        const projectLink = yield* ProjectLinkService;
        const link = yield* projectLink.resolve(process.cwd());
        return link.applicationId;
      }),
  });

const resolveOrganization = (org: Option.Option<string>) =>
  Option.match(org, {
    onSome: (value) => Effect.succeed(value),
    onNone: () =>
      Effect.gen(function* () {
        const projectLink = yield* ProjectLinkService;
        const link = yield* projectLink.load(process.cwd());
        const organizationId = Option.flatMap(link, (value) => Option.fromNullable(value.organizationId));
        if (Option.isNone(organizationId)) {
          return yield* new OrganizationRequiredError({
            message: 'Pass --org, or run the command in a linked project.',
          });
        }
        return organizationId.value;
      }),
  });

const normalizeHostname = (value: string) => value.trim().toLowerCase().replace(/\.$/, '');

/** Finds a domain of the application by hostname (any case, trailing dot allowed) or ID. */
export const findDomain = (applicationId: string, hostnameOrId: string) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const { items } = yield* apiClient.request((client) => client.applications.domains.list(applicationId));
    const wanted = normalizeHostname(hostnameOrId);
    const domain = items.find(
      (item) => item.id === hostnameOrId || item.hostname === wanted || item.unicodeHostname === wanted
    );
    if (!domain) {
      return yield* new DomainNotFoundError({ message: `No custom domain ${hostnameOrId} on this application.` });
    }
    return domain;
  });

const printDomain = (domain: CustomDomain) =>
  Effect.gen(function* () {
    for (const line of describeDomain(domain)) yield* Console.log(line);
    const pending = domain.requiredRecords.filter((record) => record.status !== 'ok');
    const records = formatDnsRecords(pending);
    if (records.length > 0 && domain.state !== 'removing') {
      yield* Console.log('\nAdd these records at your DNS provider:');
      for (const line of records) yield* Console.log(`  ${line}`);
      if (pending.some((record) => record.type === 'ALIAS')) {
        yield* Console.log(
          '\nApex domains need an ALIAS, ANAME or flattened CNAME record. Without one, attach www instead and redirect the apex to it.'
        );
      }
    }
  });

/** Rate limits, server errors and network failures are worth another poll. */
const isTransient = (error: { readonly _tag: string; readonly statusCode?: number }) =>
  error._tag === 'ApiRequestError' &&
  (error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500);

/**
 * Polls until the domain serves traffic, reporting each state change.
 *
 * In JSON mode the progress goes to stderr and the last known domain is printed to stdout even when
 * the wait fails, so stdout always holds exactly one JSON document.
 */
export const waitUntilServing = (applicationId: string, initial: CustomDomain, timeoutMinutes: number, json: boolean) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const progress = (line: string) => (json ? Console.error(line) : Console.log(line));
    const fail = (domain: CustomDomain, message: string) =>
      Effect.gen(function* () {
        if (json) yield* Console.log(JSON.stringify(domain, null, 2));
        return yield* new DomainWaitError({ message, state: domain.state });
      });

    const deadline = (yield* Clock.currentTimeMillis) + Duration.toMillis(Duration.minutes(timeoutMinutes));
    let domain = initial;
    yield* progress(`Waiting for ${domain.unicodeHostname} (${DOMAIN_STATE_LABELS[domain.state]})...`);

    while (IN_PROGRESS_STATES.has(domain.state)) {
      const remaining = deadline - (yield* Clock.currentTimeMillis);
      if (remaining <= 0) {
        return yield* fail(
          domain,
          `${domain.unicodeHostname} is not serving yet (${DOMAIN_STATE_LABELS[domain.state]}). Check again later with "gigadrive domains inspect ${domain.hostname}".`
        );
      }
      yield* Effect.sleep(Duration.min(POLL_INTERVAL, Duration.millis(remaining)));
      const polled = yield* Effect.either(
        apiClient.request((client) => client.applications.domains.get(applicationId, domain.id))
      );
      if (Either.isLeft(polled)) {
        // A blip (rate limit, 5xx, network) should not end a ten-minute wait; the loop retries until the deadline.
        if (isTransient(polled.left)) continue;
        return yield* polled.left;
      }
      if (polled.right.state !== domain.state) {
        yield* progress(`  ${DOMAIN_STATE_LABELS[polled.right.state]}`);
      }
      domain = polled.right;
    }

    if (domain.state !== 'active' && domain.state !== 'degraded') {
      return yield* fail(
        domain,
        `${domain.unicodeHostname} is ${DOMAIN_STATE_LABELS[domain.state]}${domain.error ? `: ${domain.error.message}` : ''}`
      );
    }
    yield* progress(`\n${domain.unicodeHostname} is live: https://${domain.hostname}`);
    if (json) yield* Console.log(JSON.stringify(domain, null, 2));
    return domain;
  });

/** What to tell the user for a failed command, keeping the typed error as the exit status. */
export const errorMessage = (
  action: string,
  error: { readonly _tag: string; readonly message: string; readonly code?: string; readonly reason?: string }
) => {
  switch (error._tag) {
    case 'NotAuthenticatedError':
      return 'You are not logged in. Run "gigadrive login" to authenticate.';
    case 'ApiRequestError':
      if (error.code === 'quota_exceeded' && error.reason === 'daily_add_limit') {
        return `${error.message}\nThe daily limit resets within 24 hours; upgrading your plan raises it.`;
      }
      if (error.code === 'quota_exceeded') {
        return `${error.message}\nSee your plan's limits and upgrade at ${CONSOLE_URL} (organization settings > Limits).`;
      }
      if (error.code === 'invalid_target' && error.reason === 'redirects_not_available') {
        return `${error.message}\nRedirect domains are available on paid plans. Upgrade at ${CONSOLE_URL}.`;
      }
      if (error.code === 'domain_in_use' && error.reason === 'other_organization') {
        return `${error.message}\nIf you control the domain, verify it with "gigadrive domains owners add <domain>", then move it with "gigadrive domains claim <hostname>".`;
      }
      return `Failed to ${action}: ${error.message}`;
    default:
      return error.message;
  }
};

/** Prints what went wrong while keeping the typed error, so the command still exits non-zero. */
const reportErrors =
  (action: string) =>
  <A, E extends { readonly _tag: string; readonly message: string }, R>(self: Effect.Effect<A, E, R>) =>
    Effect.tapError(self, (error) => Console.error(errorMessage(action, error)));

const listCommand = Command.make('list', { app: appOption, json: jsonOption }, ({ app, json }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const applicationId = yield* resolveApplication(app);
    const { items } = yield* apiClient.request((client) => client.applications.domains.list(applicationId));
    if (json) return yield* Console.log(JSON.stringify(items, null, 2));
    if (items.length === 0) {
      return yield* Console.log('No custom domains. Add one with "gigadrive domains add <hostname>".');
    }
    const width = Math.max(...items.map((item) => item.unicodeHostname.length));
    for (const item of items) {
      const problem = item.error ? `  ${item.error.code}` : '';
      yield* Console.log(
        `${item.unicodeHostname.padEnd(width)}  ${DOMAIN_STATE_LABELS[item.state]}${item.primary ? ' (primary)' : ''}${problem}`
      );
    }
  }).pipe(reportErrors('list custom domains'))
);

/** Input of {@link addDomain}. */
export interface AddDomainInput extends TargetFlags {
  readonly hostname: string;
  readonly applicationId: string;
  readonly wait: boolean;
  readonly timeout: number;
  readonly json: boolean;
}

/** Attaches a hostname and optionally waits until it serves. */
export const addDomain = (input: AddDomainInput) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const target = yield* targetFromFlags(input);
    const timeout = yield* requirePositiveTimeout(input.timeout);
    const domain = yield* apiClient.request((client) =>
      client.applications.domains.add(input.applicationId, { hostname: input.hostname, target })
    );
    if (input.wait) return yield* waitUntilServing(input.applicationId, domain, timeout, input.json);
    if (input.json) {
      yield* Console.log(JSON.stringify(domain, null, 2));
      return domain;
    }
    yield* printDomain(domain);
    if (IN_PROGRESS_STATES.has(domain.state)) {
      yield* Console.log(
        `\nGigadrive checks the records automatically. Follow progress with "gigadrive domains inspect ${domain.hostname}".`
      );
    }
    return domain;
  });

const addCommand = Command.make(
  'add',
  {
    hostname: hostnameArg,
    app: appOption,
    production: productionOption,
    branch: branchOption,
    redirectTo: redirectToOption,
    status: statusOption,
    dropPath: dropPathOption,
    wait: waitOption,
    timeout: timeoutOption,
    json: jsonOption,
  },
  ({ app, ...options }) =>
    Effect.gen(function* () {
      const applicationId = yield* resolveApplication(app);
      yield* addDomain({ ...options, applicationId });
    }).pipe(reportErrors('add the domain'))
);

const updateCommand = Command.make(
  'update',
  {
    domain: domainArg,
    app: appOption,
    production: productionOption,
    branch: branchOption,
    redirectTo: redirectToOption,
    status: statusOption,
    dropPath: dropPathOption,
    primary: primaryOption,
    json: jsonOption,
  },
  ({ domain: hostnameOrId, app, primary, json, ...flags }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const target = yield* targetFromFlags(flags);
      if (target === undefined && !primary) {
        return yield* new InvalidDomainOptionsError({
          message: 'Nothing to change. Pass --production, --branch, --redirect-to or --primary.',
        });
      }
      const applicationId = yield* resolveApplication(app);
      const found = yield* findDomain(applicationId, hostnameOrId);
      const domain = yield* apiClient.request((client) =>
        client.applications.domains.update(applicationId, found.id, {
          ...(target === undefined ? {} : { target }),
          ...(primary ? { primary: true } : {}),
        })
      );
      if (json) return yield* Console.log(JSON.stringify(domain, null, 2));
      yield* printDomain(domain);
    }).pipe(reportErrors('update the domain'))
);

const claimCommand = Command.make(
  'claim',
  {
    hostname: hostnameArg.pipe(Args.withDescription('Hostname another organization attached')),
    app: appOption,
    json: jsonOption,
  },
  ({ hostname, app, json }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const applicationId = yield* resolveApplication(app);
      const domain = yield* apiClient.request((client) => client.applications.domains.claim(applicationId, hostname));
      if (json) return yield* Console.log(JSON.stringify(domain, null, 2));
      yield* Console.log(`Moved ${domain.unicodeHostname} to this application.`);
      yield* printDomain(domain);
    }).pipe(reportErrors('claim the domain'))
);

const inspectCommand = Command.make(
  'inspect',
  { domain: domainArg, app: appOption, json: jsonOption },
  ({ domain: hostnameOrId, app, json }) =>
    Effect.gen(function* () {
      const applicationId = yield* resolveApplication(app);
      const domain = yield* findDomain(applicationId, hostnameOrId);
      if (json) return yield* Console.log(JSON.stringify(domain, null, 2));
      yield* printDomain(domain);
      if (domain.nextCheckAt !== null) yield* Console.log(`\nNext automatic check: ${domain.nextCheckAt}`);
    }).pipe(reportErrors('inspect the domain'))
);

const checkCommand = Command.make(
  'check',
  { domain: domainArg, app: appOption, wait: waitOption, timeout: timeoutOption, json: jsonOption },
  ({ domain: hostnameOrId, app, wait, timeout, json }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const minutes = yield* requirePositiveTimeout(timeout);
      const applicationId = yield* resolveApplication(app);
      const found = yield* findDomain(applicationId, hostnameOrId);
      const domain = yield* apiClient.request((client) => client.applications.domains.refresh(applicationId, found.id));
      if (wait) return yield* waitUntilServing(applicationId, domain, minutes, json);
      if (json) return yield* Console.log(JSON.stringify(domain, null, 2));
      yield* Console.log(`Checking ${domain.unicodeHostname}.`);
      yield* printDomain(domain);
    }).pipe(reportErrors('check the domain'))
);

/** Removes a domain after confirmation. */
export const removeDomain = (applicationId: string, hostnameOrId: string, yes: boolean) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const domain = yield* findDomain(applicationId, hostnameOrId);
    const confirmed = yield* confirm(
      `Remove ${domain.unicodeHostname}? It stops serving this application immediately.`,
      yes
    );
    if (!confirmed) return yield* Console.log('Cancelled.');
    yield* apiClient.request((client) => client.applications.domains.remove(applicationId, domain.id));
    yield* Console.log(`Removed ${domain.unicodeHostname}.`);
  });

const removeCommand = Command.make(
  'rm',
  { domain: domainArg, app: appOption, yes: yesOption },
  ({ domain: hostnameOrId, app, yes }) =>
    Effect.gen(function* () {
      const applicationId = yield* resolveApplication(app);
      yield* removeDomain(applicationId, hostnameOrId, yes);
    }).pipe(
      // Ctrl+C at the confirmation is a deliberate cancel, not a failure.
      Effect.catchTag('QuitException', () => Console.log('Cancelled.')),
      reportErrors('remove the domain')
    )
);

const findOwnership = (organizationId: string, name: string) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const { items } = yield* apiClient.request((client) => client.organizations.domains.list(organizationId));
    const wanted = normalizeHostname(name);
    const claim = items.find((item) => item.id === name || item.name === wanted || item.unicodeName === wanted);
    if (!claim) {
      return yield* new DomainNotFoundError({
        message: `${name} is not claimed. Add it with "gigadrive domains owners add".`,
      });
    }
    return claim;
  });

const ownersListCommand = Command.make('list', { org: orgOption, json: jsonOption }, ({ org, json }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const organizationId = yield* resolveOrganization(org);
    const { items } = yield* apiClient.request((client) => client.organizations.domains.list(organizationId));
    if (json) return yield* Console.log(JSON.stringify(items, null, 2));
    if (items.length === 0) return yield* Console.log('No verified domains.');
    const width = Math.max(...items.map((item) => item.unicodeName.length));
    for (const item of items) {
      yield* Console.log(`${item.unicodeName.padEnd(width)}  ${item.status}`);
    }
  }).pipe(reportErrors('list verified domains'))
);

const ownersAddCommand = Command.make(
  'add',
  {
    name: Args.text({ name: 'domain' }).pipe(Args.withDescription('Domain to verify, e.g. example.com')),
    org: orgOption,
    json: jsonOption,
  },
  ({ name, org, json }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const organizationId = yield* resolveOrganization(org);
      const claim = yield* apiClient.request((client) => client.organizations.domains.add(organizationId, name));
      if (json) return yield* Console.log(JSON.stringify(claim, null, 2));
      if (claim.status === 'verified') {
        return yield* Console.log(`${claim.unicodeName} is verified.`);
      }
      yield* Console.log(`Publish this TXT record for ${claim.unicodeName}:`);
      yield* Console.log(`  Name:  ${claim.record.host}`);
      yield* Console.log(`  Value: ${claim.record.value}`);
      yield* Console.log(`\nThen run "gigadrive domains owners verify ${claim.name}".`);
    }).pipe(reportErrors('add the domain'))
);

const ownersVerifyCommand = Command.make(
  'verify',
  { name: Args.text({ name: 'domain' }).pipe(Args.withDescription('Domain to verify')), org: orgOption },
  ({ name, org }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const organizationId = yield* resolveOrganization(org);
      const claim = yield* findOwnership(organizationId, name);
      const checked = yield* apiClient.request((client) =>
        client.organizations.domains.verify(organizationId, claim.id)
      );
      if (checked.status === 'verified') {
        return yield* Console.log(`${checked.unicodeName} is verified.`);
      }
      yield* Console.log(
        `${checked.unicodeName} is not verified yet${checked.error ? `: ${checked.error.message}` : '.'} Gigadrive keeps checking automatically.`
      );
    }).pipe(reportErrors('verify the domain'))
);

const ownersRemoveCommand = Command.make(
  'rm',
  {
    name: Args.text({ name: 'domain' }).pipe(Args.withDescription('Domain to remove')),
    org: orgOption,
    yes: yesOption,
  },
  ({ name, org, yes }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const organizationId = yield* resolveOrganization(org);
      const claim = yield* findOwnership(organizationId, name);
      const confirmed = yield* confirm(
        `Remove ${claim.unicodeName} from your organization's domains? Custom domains that rely on it must be removed first.`,
        yes
      );
      if (!confirmed) return yield* Console.log('Cancelled.');
      yield* apiClient.request((client) => client.organizations.domains.remove(organizationId, claim.id));
      yield* Console.log(`Removed ${claim.unicodeName}.`);
    }).pipe(
      Effect.catchTag('QuitException', () => Console.log('Cancelled.')),
      reportErrors('remove the domain')
    )
);

const ownersCommand = Command.make('owners', {}, () => Effect.void).pipe(
  Command.withDescription('Domains your organization verified with a TXT record'),
  Command.withSubcommands([ownersListCommand, ownersAddCommand, ownersVerifyCommand, ownersRemoveCommand])
);

const domainsBase = Command.make('domains', {}, () => Effect.void).pipe(
  Command.withDescription('Custom domains of the linked application')
);

/** `gigadrive domains` — attach, change, inspect and remove custom domains, and verify domain ownership. */
export const domainsCommand = domainsBase.pipe(
  Command.withSubcommands([
    listCommand,
    addCommand,
    updateCommand,
    claimCommand,
    inspectCommand,
    checkCommand,
    removeCommand,
    ownersCommand,
  ])
);
