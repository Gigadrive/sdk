import { Args, Command, Options, Prompt } from '@effect/cli';
import type { CustomDomain, CustomDomainTargetInput } from '@gigadrive/sdk';
import { Console, Duration, Effect, Option } from 'effect';
import { DomainNotFoundError, DomainWaitError, OrganizationRequiredError } from '../../errors';
import { describeDomain, DOMAIN_STATE_LABELS, formatDnsRecords, IN_PROGRESS_STATES } from '../../lib/domain-output';
import { ApiClientService } from '../../services/api-client';
import { ProjectLinkService } from '../../services/project-link';

const REDIRECT_STATUS_CODES = ['301', '302', '307', '308'] as const;

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

const jsonOption = Options.boolean('json').pipe(Options.withDescription('Print the result as JSON'));

const waitOption = Options.boolean('wait').pipe(
  Options.withAlias('w'),
  Options.withDescription('Wait until the domain serves traffic, printing each state change')
);

const timeoutOption = Options.integer('timeout').pipe(
  Options.withDescription('Minutes to wait with --wait (default: 10)'),
  Options.withDefault(10)
);

const branchOption = Options.text('branch').pipe(
  Options.withDescription('Serve the latest deployment of this branch ID instead of production'),
  Options.optional
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

const yesOption = Options.boolean('yes').pipe(
  Options.withAlias('y'),
  Options.withDescription('Remove without confirmation')
);

const hostnameArg = Args.text({ name: 'hostname' }).pipe(
  Args.withDescription('Hostname to attach, e.g. shop.example.com or example.com')
);

const domainArg = Args.text({ name: 'hostname-or-id' }).pipe(Args.withDescription('Domain hostname or ID'));

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

/** Finds a domain of the application by hostname (any case) or ID. */
const findDomain = (applicationId: string, hostnameOrId: string) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const { items } = yield* apiClient.request((client) => client.applications.domains.list(applicationId));
    const wanted = hostnameOrId.trim().toLowerCase().replace(/\.$/, '');
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
    const records = formatDnsRecords(domain.requiredRecords.filter((record) => record.status !== 'ok'));
    if (records.length > 0 && domain.state !== 'removing') {
      yield* Console.log('\nAdd these records at your DNS provider:');
      for (const line of records) yield* Console.log(`  ${line}`);
      if (domain.requiredRecords.some((record) => record.type === 'ALIAS')) {
        yield* Console.log(
          '\nApex domains need an ALIAS, ANAME or flattened CNAME record. Without one, attach www instead and redirect the apex to it.'
        );
      }
    }
  });

/** Polls until the domain serves traffic, printing each state change. */
const waitUntilServing = (applicationId: string, initial: CustomDomain, timeoutMinutes: number) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const deadline = Date.now() + Duration.toMillis(Duration.minutes(timeoutMinutes));
    let domain = initial;
    let lastState = domain.state;
    yield* Console.log(`Waiting for ${domain.unicodeHostname} (${DOMAIN_STATE_LABELS[domain.state]})...`);

    while (IN_PROGRESS_STATES.has(domain.state)) {
      if (Date.now() >= deadline) {
        return yield* new DomainWaitError({
          message: `${domain.unicodeHostname} is not serving yet (${DOMAIN_STATE_LABELS[domain.state]}). Check again later with "gigadrive domains inspect ${domain.hostname}".`,
          state: domain.state,
        });
      }
      yield* Effect.sleep(Duration.seconds(5));
      const current = yield* apiClient.request((client) => client.applications.domains.get(applicationId, domain.id));
      domain = current;
      if (domain.state !== lastState) {
        lastState = domain.state;
        yield* Console.log(`  ${DOMAIN_STATE_LABELS[domain.state]}`);
      }
    }

    if (domain.state !== 'active' && domain.state !== 'degraded') {
      return yield* new DomainWaitError({
        message: `${domain.unicodeHostname} is ${DOMAIN_STATE_LABELS[domain.state]}${domain.error ? `: ${domain.error.message}` : ''}`,
        state: domain.state,
      });
    }
    yield* Console.log(`\n${domain.unicodeHostname} is live: https://${domain.hostname}`);
    return domain;
  });

/** What to tell the user for a failed command, keeping the typed error as the exit status. */
const errorMessage = (
  action: string,
  error: { readonly _tag: string; readonly message: string; readonly code?: string }
) => {
  switch (error._tag) {
    case 'NotAuthenticatedError':
      return 'You are not logged in. Run "gigadrive login" to authenticate.';
    case 'ApiRequestError':
      return error.code === 'quota_exceeded'
        ? `${error.message}\nReview your plan's limits in the console under Settings > Limits.`
        : `Failed to ${action}: ${error.message}`;
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

const addCommand = Command.make(
  'add',
  {
    hostname: hostnameArg,
    app: appOption,
    branch: branchOption,
    redirectTo: redirectToOption,
    status: statusOption,
    dropPath: dropPathOption,
    wait: waitOption,
    timeout: timeoutOption,
    json: jsonOption,
  },
  ({ hostname, app, branch, redirectTo, status, dropPath, wait, timeout, json }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const applicationId = yield* resolveApplication(app);
      const target: CustomDomainTargetInput = Option.isSome(redirectTo)
        ? {
            type: 'redirect',
            to: redirectTo.value,
            statusCode: Option.match(status, {
              onNone: () => undefined,
              onSome: (code) => (code === '301' ? 301 : code === '302' ? 302 : code === '307' ? 307 : 308),
            }),
            preservePath: !dropPath,
          }
        : Option.isSome(branch)
          ? { type: 'branch', branchId: branch.value }
          : { type: 'production' };

      const domain = yield* apiClient.request((client) =>
        client.applications.domains.add(applicationId, { hostname, target })
      );
      if (json && !wait) return yield* Console.log(JSON.stringify(domain, null, 2));
      yield* printDomain(domain);
      if (wait) {
        const live = yield* waitUntilServing(applicationId, domain, timeout);
        if (json) yield* Console.log(JSON.stringify(live, null, 2));
      } else if (IN_PROGRESS_STATES.has(domain.state)) {
        yield* Console.log(
          `\nGigadrive checks the records automatically. Follow progress with "gigadrive domains inspect ${domain.hostname}".`
        );
      }
    }).pipe(reportErrors('add the domain'))
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
  { domain: domainArg, app: appOption, wait: waitOption, timeout: timeoutOption },
  ({ domain: hostnameOrId, app, wait, timeout }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const applicationId = yield* resolveApplication(app);
      const found = yield* findDomain(applicationId, hostnameOrId);
      const domain = yield* apiClient.request((client) => client.applications.domains.refresh(applicationId, found.id));
      yield* Console.log(`Checking ${domain.unicodeHostname}.`);
      if (wait) yield* waitUntilServing(applicationId, domain, timeout);
      else yield* printDomain(domain);
    }).pipe(reportErrors('check the domain'))
);

const removeCommand = Command.make(
  'rm',
  { domain: domainArg, app: appOption, yes: yesOption },
  ({ domain: hostnameOrId, app, yes }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const applicationId = yield* resolveApplication(app);
      const domain = yield* findDomain(applicationId, hostnameOrId);
      if (!yes) {
        const confirmed = yield* Prompt.run(
          Prompt.confirm({
            message: `Remove ${domain.unicodeHostname}? It stops serving this application immediately.`,
            initial: false,
          })
        );
        if (!confirmed) return yield* Console.log('Cancelled.');
      }
      yield* apiClient.request((client) => client.applications.domains.remove(applicationId, domain.id));
      yield* Console.log(`Removed ${domain.unicodeHostname}.`);
    }).pipe(
      // Ctrl+C at the confirmation is a deliberate cancel, not a failure.
      Effect.catchTag('QuitException', () => Console.log('Cancelled.')),
      reportErrors('remove the domain')
    )
);

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
  },
  ({ name, org }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const organizationId = yield* resolveOrganization(org);
      const claim = yield* apiClient.request((client) => client.organizations.domains.add(organizationId, name));
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
      const { items } = yield* apiClient.request((client) => client.organizations.domains.list(organizationId));
      const wanted = name.trim().toLowerCase().replace(/\.$/, '');
      const claim = items.find((item) => item.id === name || item.name === wanted || item.unicodeName === wanted);
      if (!claim) {
        return yield* new DomainNotFoundError({
          message: `${name} is not claimed. Add it with "gigadrive domains owners add".`,
        });
      }
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

const ownersCommand = Command.make('owners', {}, () => Effect.void).pipe(
  Command.withDescription('Domains your organization verified with a TXT record'),
  Command.withSubcommands([ownersListCommand, ownersAddCommand, ownersVerifyCommand])
);

const domainsBase = Command.make('domains', {}, () => Effect.void).pipe(
  Command.withDescription('Custom domains of the linked application')
);

/** `gigadrive domains` — attach, inspect and remove custom domains, and verify domain ownership. */
export const domainsCommand = domainsBase.pipe(
  Command.withSubcommands([listCommand, addCommand, inspectCommand, checkCommand, removeCommand, ownersCommand])
);
