import { Args, Command, Options } from '@effect/cli';
import { FileSystem } from '@effect/platform';
import type { AiGatewayBudgetInput, AiGatewayPolicyInput } from '@gigadrive/sdk';
import { Console, Effect, Option } from 'effect';
import { ApiRequestError, ProjectNotLinkedError } from '../../errors';
import { ApiClientService } from '../../services/api-client';
import { ProjectLinkService } from '../../services/project-link';

// ---------------------------------------------------------------------------
// Shared options / helpers
// ---------------------------------------------------------------------------

const orgOption = Options.text('org').pipe(
  Options.withAlias('o'),
  Options.withDescription('Organization ID (defaults to the linked organization)'),
  Options.optional
);

const appOption = Options.text('app').pipe(
  Options.withAlias('a'),
  Options.withDescription('Restrict to this application ID'),
  Options.optional
);

const fromOption = Options.text('from').pipe(
  Options.withDescription('Include usage at or after this ISO 8601 timestamp'),
  Options.optional
);

const toOption = Options.text('to').pipe(
  Options.withDescription('Include usage before or at this ISO 8601 timestamp'),
  Options.optional
);

const fileOption = Options.text('file').pipe(
  Options.withAlias('f'),
  Options.withDescription('Path to a JSON file, or "-" for stdin (default: stdin)'),
  Options.optional
);

/** Resolve the organization ID from `--org` or the linked project. */
const resolveOrgId = (org: Option.Option<string>) =>
  Effect.gen(function* () {
    if (Option.isSome(org)) return org.value;
    const projectLink = yield* ProjectLinkService;
    const link = yield* projectLink.resolve(process.cwd());
    if (link.organizationId === undefined) {
      return yield* Effect.fail(
        new ProjectNotLinkedError({
          message: 'No organization is linked. Pass --org <id> or re-run "gigadrive link".',
          directory: process.cwd(),
        })
      );
    }
    return link.organizationId;
  });

/** Read all of stdin as a UTF-8 string. */
const readStdin = Effect.async<string, ApiRequestError>((resume) => {
  let data = '';
  const stdin = process.stdin;
  stdin.setEncoding('utf8');
  const onData = (chunk: string) => {
    data += chunk;
  };
  const cleanup = () => {
    stdin.off('data', onData);
    stdin.off('end', onEnd);
    stdin.off('error', onError);
  };
  const onEnd = () => {
    cleanup();
    resume(Effect.succeed(data));
  };
  const onError = (err: Error) => {
    cleanup();
    resume(Effect.fail(new ApiRequestError({ message: `Failed to read stdin: ${err.message}` })));
  };
  stdin.on('data', onData);
  stdin.on('end', onEnd);
  stdin.on('error', onError);
  stdin.resume();
});

/** Read JSON from a file (or stdin when the path is omitted or `-`). */
const readJsonInput = (file: Option.Option<string>) =>
  Effect.gen(function* () {
    const path = Option.getOrUndefined(file);
    let raw: string;
    if (path === undefined || path === '-') {
      raw = yield* readStdin;
    } else {
      const fs = yield* FileSystem.FileSystem;
      raw = yield* fs
        .readFileString(path, 'utf8')
        .pipe(Effect.mapError((e) => new ApiRequestError({ message: `Failed to read ${path}: ${String(e)}` })));
    }
    return yield* Effect.try({
      try: () => JSON.parse(raw) as unknown,
      catch: () => new ApiRequestError({ message: 'Input is not valid JSON.' }),
    });
  });

/** Shared error handlers for the governance commands. */
const governanceErrorHandlers = {
  NotAuthenticatedError: () => Console.error('You are not logged in. Run "gigadrive login" to authenticate.'),
  ApiRequestError: (err: ApiRequestError) => Console.error(err.message),
  ProjectNotLinkedError: (err: ProjectNotLinkedError) => Console.error(err.message),
  ProjectLinkReadError: (err: { message: string }) => Console.error(err.message),
};

// ---------------------------------------------------------------------------
// ai usage
// ---------------------------------------------------------------------------

const usageSummaryCommand = Command.make(
  'summary',
  { org: orgOption, app: appOption, from: fromOption, to: toOption },
  ({ org, app, from, to }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const orgId = yield* resolveOrgId(org);
      const summary = yield* apiClient.request((client) =>
        client.organizations.aiGateway.usage.summary(orgId, {
          applicationId: Option.getOrUndefined(app),
          from: Option.getOrUndefined(from),
          to: Option.getOrUndefined(to),
        })
      );
      yield* Console.log(JSON.stringify(summary, null, 2));
    }).pipe(Effect.catchTags(governanceErrorHandlers))
);

const usageRequestsCommand = Command.make(
  'requests',
  { org: orgOption, app: appOption, from: fromOption, to: toOption },
  ({ org, app, from, to }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const orgId = yield* resolveOrgId(org);
      const { items, total } = yield* apiClient.request((client) =>
        client.organizations.aiGateway.usage.requests(orgId, {
          applicationId: Option.getOrUndefined(app),
          from: Option.getOrUndefined(from),
          to: Option.getOrUndefined(to),
        })
      );
      if (items.length === 0) {
        yield* Console.log('No AI Gateway requests found.');
        return;
      }
      for (const e of items) {
        yield* Console.log(
          `${e.createdAt}  ${e.modelRequested}  ${e.status}  ${e.totalTokens} tok  ${e.billableCostMicros}µ$`
        );
      }
      yield* Console.log(`\n${total} request(s).`);
    }).pipe(Effect.catchTags(governanceErrorHandlers))
);

const outOption = Options.text('out').pipe(
  Options.withDescription('Write the CSV to this file instead of stdout'),
  Options.optional
);

const usageExportCommand = Command.make(
  'export',
  { org: orgOption, app: appOption, from: fromOption, to: toOption, out: outOption },
  ({ org, app, from, to, out }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const orgId = yield* resolveOrgId(org);
      const csv = yield* apiClient.request((client) =>
        client.organizations.aiGateway.usage.export(orgId, {
          applicationId: Option.getOrUndefined(app),
          from: Option.getOrUndefined(from),
          to: Option.getOrUndefined(to),
        })
      );
      const outPath = Option.getOrUndefined(out);
      if (outPath === undefined) {
        yield* Console.log(csv);
      } else {
        const fs = yield* FileSystem.FileSystem;
        yield* fs
          .writeFileString(outPath, csv)
          .pipe(Effect.mapError((e) => new ApiRequestError({ message: `Failed to write ${outPath}: ${String(e)}` })));
        yield* Console.log(`Wrote ${outPath}.`);
      }
    }).pipe(Effect.catchTags(governanceErrorHandlers))
);

const usageCommand = Command.make('usage', {}, () => Effect.void).pipe(
  Command.withSubcommands([usageSummaryCommand, usageRequestsCommand, usageExportCommand])
);

// ---------------------------------------------------------------------------
// ai budgets
// ---------------------------------------------------------------------------

const budgetsGetCommand = Command.make('get', { org: orgOption }, ({ org }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const orgId = yield* resolveOrgId(org);
    const { items } = yield* apiClient.request((client) => client.organizations.aiGateway.budgets.list(orgId));
    yield* Console.log(JSON.stringify(items, null, 2));
  }).pipe(Effect.catchTags(governanceErrorHandlers))
);

const budgetsSetCommand = Command.make('set', { org: orgOption, file: fileOption }, ({ org, file }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const orgId = yield* resolveOrgId(org);
    const parsed = yield* readJsonInput(file);
    const budgets = Array.isArray(parsed) ? parsed : (parsed as { budgets?: unknown }).budgets;
    if (!Array.isArray(budgets)) {
      yield* Console.error('Expected a JSON array of budgets, or an object of the form { "budgets": [...] }.');
      return;
    }
    const { items } = yield* apiClient.request((client) =>
      client.organizations.aiGateway.budgets.replace(orgId, budgets as AiGatewayBudgetInput[])
    );
    yield* Console.log(`Saved ${items.length} budget(s).`);
  }).pipe(Effect.catchTags(governanceErrorHandlers))
);

const budgetsCommand = Command.make('budgets', {}, () => Effect.void).pipe(
  Command.withSubcommands([budgetsGetCommand, budgetsSetCommand])
);

// ---------------------------------------------------------------------------
// ai policies
// ---------------------------------------------------------------------------

const policiesGetCommand = Command.make('get', { org: orgOption, app: appOption }, ({ org, app }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const orgId = yield* resolveOrgId(org);
    const policy = yield* apiClient.request((client) =>
      client.organizations.aiGateway.policies.get(orgId, { applicationId: Option.getOrUndefined(app) })
    );
    yield* Console.log(policy === null ? 'No policy set.' : JSON.stringify(policy, null, 2));
  }).pipe(Effect.catchTags(governanceErrorHandlers))
);

const policiesSetCommand = Command.make('set', { org: orgOption, file: fileOption }, ({ org, file }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const orgId = yield* resolveOrgId(org);
    const parsed = yield* readJsonInput(file);
    const policy = yield* apiClient.request((client) =>
      client.organizations.aiGateway.policies.put(orgId, parsed as AiGatewayPolicyInput)
    );
    yield* Console.log(`Policy saved${policy.applicationId ? ` for application ${policy.applicationId}` : ''}.`);
  }).pipe(Effect.catchTags(governanceErrorHandlers))
);

const policiesCommand = Command.make('policies', {}, () => Effect.void).pipe(
  Command.withSubcommands([policiesGetCommand, policiesSetCommand])
);

// ---------------------------------------------------------------------------
// ai models
// ---------------------------------------------------------------------------

const inferenceErrorHandlers = {
  NotAuthenticatedError: () => Console.error('You are not logged in. Run "gigadrive login" to authenticate.'),
  ApiRequestError: (err: ApiRequestError) => Console.error(err.message),
};

const modelsListCommand = Command.make('list', {}, () =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const { items } = yield* apiClient.request((client) => client.aiGateway.listModels());
    for (const m of items) {
      yield* Console.log(`${m.id}  ${m.name}  (ctx ${m.contextWindow})`);
    }
  }).pipe(Effect.catchTags(inferenceErrorHandlers))
);

const modelIdArg = Args.text({ name: 'model-id' }).pipe(Args.withDescription('The model ID, e.g. openai/gpt-4o'));

const modelsGetCommand = Command.make('get', { modelId: modelIdArg }, ({ modelId }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const model = yield* apiClient.request((client) => client.aiGateway.getModel(modelId));
    yield* Console.log(JSON.stringify(model, null, 2));
  }).pipe(Effect.catchTags(inferenceErrorHandlers))
);

const modelsCommand = Command.make('models', {}, () => Effect.void).pipe(
  Command.withSubcommands([modelsListCommand, modelsGetCommand])
);

// ---------------------------------------------------------------------------
// ai chat
// ---------------------------------------------------------------------------

const modelOption = Options.text('model').pipe(
  Options.withAlias('m'),
  Options.withDescription('The model ID to use, e.g. openai/gpt-4o')
);

const streamOption = Options.boolean('stream').pipe(Options.withDescription('Stream the response token by token'));

const promptArg = Args.text({ name: 'prompt' }).pipe(
  Args.withDescription('The prompt text, or "-" to read from stdin')
);

const chatCommand = Command.make(
  'chat',
  { prompt: promptArg, model: modelOption, stream: streamOption },
  ({ prompt, model, stream }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const text = prompt === '-' ? yield* readStdin : prompt;
      const messages = [{ role: 'user', content: text }];

      if (stream) {
        const client = yield* apiClient.getClient;
        yield* Effect.tryPromise({
          try: async () => {
            for await (const chunk of client.aiGateway.chatCompletionsStream({ model, messages })) {
              process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
            }
            process.stdout.write('\n');
          },
          catch: (error) => new ApiRequestError({ message: error instanceof Error ? error.message : String(error) }),
        });
        return;
      }

      const response = yield* apiClient.request((client) => client.aiGateway.chatCompletions({ model, messages }));
      const content = response.choices[0]?.message.content;
      yield* Console.log(typeof content === 'string' ? content : JSON.stringify(content));
    }).pipe(Effect.catchTags(inferenceErrorHandlers))
);

// ---------------------------------------------------------------------------
// ai (parent)
// ---------------------------------------------------------------------------

const aiBase = Command.make('ai', {}, () => Effect.void);

/** `gigadrive ai` — AI Gateway governance (usage, budgets, policies) and inference (models, chat). */
export const aiCommand = aiBase.pipe(
  Command.withSubcommands([usageCommand, budgetsCommand, policiesCommand, modelsCommand, chatCommand])
);
