export const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Config V4',
  description: 'Configuration schema for version 4',
  type: 'object',
  required: ['version'],
  properties: {
    version: {
      type: 'integer',
      enum: [4],
      description: 'The version of the configuration file',
    },
    presets: {
      type: ['array', 'null'],
      items: {
        type: 'string',
        format: 'uri',
      },
      description: 'A list of presets to apply to the project. Each preset will be applied in order.',
    },
    assets: {
      type: ['string', 'null'],
      description: 'The folder which holds the assets to be deployed to the edge. Defaults to none.',
    },
    populateAssetCache: {
      type: ['boolean', 'null'],
      description:
        'If true, the assets will be cached at the edge during deployment. This may increase the deployment time, depending on the size of the assets. Defaults to false.',
    },
    regions: {
      type: ['array', 'null'],
      description:
        'The regions to which the project will be deployed. Use "global" to deploy to all regions. More regions will incur higher costs.',
      items: {
        type: 'string',
      },
    },
    build_commands: {
      type: ['array', 'null'],
      description: 'The commands to run to build the project. For example, `bun install` or `npm install`.',
      items: {
        type: 'string',
      },
    },
    functions: {
      type: ['object', 'null'],
      description: 'The serverless functions to deploy.',
      additionalProperties: {
        type: 'object',
        properties: {
          memory: {
            type: 'number',
            description: 'The memory in MB to allocate to the function. Defaults to 128.',
            maximum: 3009,
            minimum: 128,
          },
          max_duration: {
            type: 'number',
            description:
              'The max duration in seconds for the function after which it will be terminated. Defaults to 30.',
            maximum: 900,
            minimum: 1,
          },
          runtime: {
            $ref: '#/$defs/runtimes',
            description: 'The runtime to use for the function.',
          },
          schedule: {
            type: 'string',
            description: 'An expression to schedule the function to run at specific times.',
            pattern:
              '^(?:rate[(](?:(?:1[ ]+(hour|minute|day))|(?:[0-9]+[ ]+(hours|minutes|days)))[)])|(?:cron[(](?:(?:(?:[0-5]?[0-9])|[*])(?:(?:[-](?:(?:[0-5]?[0-9])|[*]))|(?:[/][0-9]+))?(?:[,](?:(?:[0-5]?[0-9])|[*])(?:(?:[-](?:(?:[0-5]?[0-9])|[*]))|(?:[/][0-9]+))?)*)[ ]+(?:(?:(?:[0-2]?[0-9])|[*])(?:(?:[-](?:(?:[0-2]?[0-9])|[*]))|(?:[/][0-9]+))?(?:[,](?:(?:[0-2]?[0-9])|[*])(?:(?:[-](?:(?:[0-2]?[0-9])|[*]))|(?:[/][0-9]+))?)*)[ ]+(?:(?:[?][ ]+(?:(?:(?:[1]?[0-9])|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|[*])(?:(?:[-](?:(?:[1]?[0-9])|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|[*])(?:[/][0-9]+)?)|(?:[/][0-9]+))?(?:[,](?:(?:[1]?[0-9])|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|[*])(?:(?:[-](?:(?:[1]?[0-9])|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|[*])(?:[/][0-9]+)?)|(?:[/][0-9]+))?)*)[ ]+(?:(?:(?:[1-7]|(?:SUN|MON|TUE|WED|THU|FRI|SAT))[#][0-5])|(?:(?:(?:(?:[1-7]|(?:SUN|MON|TUE|WED|THU|FRI|SAT))L?)|[L*])(?:(?:[-](?:(?:(?:[1-7]|(?:SUN|MON|TUE|WED|THU|FRI|SAT))L?)|[L*]))|(?:[/][0-9]+))?(?:[,](?:(?:(?:[1-7]|(?:SUN|MON|TUE|WED|THU|FRI|SAT))L?)|[L*])(?:(?:[-](?:(?:(?:[1-7]|(?:SUN|MON|TUE|WED|THU|FRI|SAT))L?)|[L*]))|(?:[/][0-9]+))?)*)))|(?:(?:(?:(?:(?:[1-3]?[0-9])W?)|LW|[L*])(?:(?:[-](?:(?:(?:[1-3]?[0-9])W?)|LW|[L*]))|(?:[/][0-9]+))?(?:[,](?:(?:(?:[1-3]?[0-9])W?)|LW|[L*])(?:(?:[-](?:(?:(?:[1-3]?[0-9])W?)|LW|[L*]))|(?:[/][0-9]+))?)*)[ ]+(?:(?:(?:[1]?[0-9])|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|[*])(?:(?:[-](?:(?:[1]?[0-9])|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|[*])(?:[/][0-9]+)?)|(?:[/][0-9]+))?(?:[,](?:(?:[1]?[0-9])|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|[*])(?:(?:[-](?:(?:[1]?[0-9])|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|[*])(?:[/][0-9]+)?)|(?:[/][0-9]+))?)*)[ ]+[?]))[ ]+(?:(?:(?:[12][0-9]{3})|[*])(?:(?:[-](?:(?:[12][0-9]{3})|[*]))|(?:[/][0-9]+))?(?:[,](?:(?:[12][0-9]{3})|[*])(?:(?:[-](?:(?:[12][0-9]{3})|[*]))|(?:[/][0-9]+))?)*)[)])$',
          },
          symlinks: {
            type: 'object',
            description: "A list of symbolic links to create in the function's package.",
            maxProperties: 100,
            minProperties: 1,
            patternProperties: {
              '^.{1,256}$': {
                type: 'string',
                maxLength: 256,
              },
            },
            additionalProperties: false,
          },
          excludeFiles: {
            oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            description:
              "A glob pattern to match files that should be excluded from your Serverless Function. If you're using a Community Runtime, the behavior might vary.",
          },
          includeFiles: {
            oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            description:
              "A glob pattern to match files that should be included in your Serverless Function. If you're using a Community Runtime, the behavior might vary.",
          },
        },
      },
    },
    env: {
      type: 'object',
      maxProperties: 100,
      minProperties: 0,
      patternProperties: {
        '.+': {
          maxLength: 65536,
          minLength: 0,
          type: 'string',
        },
      },
      additionalProperties: false,
      description: 'Additional environment variables to set during runtime and build.',
    },
    routes: {
      type: ['array', 'null'],
      description: 'A list of route definitions.',
      maxItems: 1024,
      items: {
        type: 'object',
        required: ['source', 'destination'],
        properties: {
          source: {
            description: 'A pattern that matches each incoming pathname (excluding querystring).',
            type: 'string',
            maxLength: 4096,
          },
          destination: {
            description: 'An absolute pathname to an existing resource or an external URL.',
            type: 'string',
            maxLength: 4096,
          },
          has: {
            $ref: '#/$defs/matchRequirements',
          },
          missing: {
            $ref: '#/$defs/matchRequirements',
          },
          statusCode: {
            description: 'An optional integer to override the status code of the response.',
            type: 'integer',
            minimum: 100,
            maximum: 999,
          },
          redirect: {
            type: 'boolean',
            description: 'An optional boolean to force a redirect response.',
          },
          methods: {
            type: 'array',
            description: 'The HTTP methods to match for the route. Defaults to all methods.',
            items: {
              type: 'string',
              enum: ['ANY', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
            },
          },
          headers: {
            type: 'object',
            description: 'Additional headers to add to the response.',
            additionalProperties: {
              type: 'string',
            },
          },
        },
      },
    },
    services: {
      type: 'object',
      description: 'Optionally, specify additional services like databases to deploy.',
      properties: {
        redis: {
          oneOf: [
            {
              type: 'null',
            },
            {
              type: 'object',
              properties: {
                envBindings: {
                  type: 'object',
                  description:
                    "Optionally, specify what environment variables the credentials will be bound to. For example: `{ url: 'REDIS_URL' }` will bind the `url` environment variable to the Redis URL. If you don't specify any bindings, they will be bound to the REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB, and REDIS_SSL environment variables.",
                  additionalProperties: false,
                  properties: {
                    url: { type: 'string' },
                    host: { type: 'string' },
                    port: { type: 'string' },
                    password: { type: 'string' },
                    db: { type: 'string' },
                    ssl: { type: 'string' },
                  },
                },
                primaryRegion: {
                  type: 'string',
                  description: 'The primary region to deploy the Redis instance to.',
                  enum: [
                    'us-east-1',
                    'us-east-2',
                    'us-west-1',
                    'us-west-2',
                    'eu-central-1',
                    'eu-west-1',
                    'eu-west-2',
                    'sa-east-1',
                    'ap-south-1',
                    'ap-northeast-1',
                    'ap-southeast-1',
                    'ap-southeast-2',
                    'us-central1',
                  ],
                },
                readRegions: {
                  type: 'array',
                  description: 'Optionally, add additional regions to read from. More regions will incur higher costs.',
                  items: {
                    type: 'string',
                    enum: [
                      'us-east-1',
                      'us-east-2',
                      'us-west-1',
                      'us-west-2',
                      'eu-central-1',
                      'eu-west-1',
                      'eu-west-2',
                      'sa-east-1',
                      'ap-south-1',
                      'ap-northeast-1',
                      'ap-southeast-1',
                      'ap-southeast-2',
                    ],
                  },
                },
                eviction: {
                  type: 'boolean',
                  description:
                    'Optionally, enable Redis eviction. This will evict the least recently used keys in order to make space for new ones.',
                },
              },
            },
          ],
        },
        postgres: {
          oneOf: [
            {
              type: 'null',
            },
            {
              type: 'object',
              properties: {
                envBindings: {
                  type: 'object',
                  description:
                    "Optionally, specify what environment variables the credentials will be bound to. For example: `{ url: 'POSTGRES_URL' }` will bind the `url` environment variable to the Postgres URL. If you don't specify any bindings, they will be bound to the POSTGRES_URL, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DATABASE environment variables.",
                  additionalProperties: false,
                  properties: {
                    url: { type: 'string' },
                    host: { type: 'string' },
                    port: { type: 'string' },
                    user: { type: 'string' },
                    password: { type: 'string' },
                    database: { type: 'string' },
                  },
                },
                postgresVersion: {
                  type: 'string',
                  description: 'The version of Postgres to deploy.',
                  enum: ['17', '16', '15', '14'],
                },
                region: {
                  type: 'string',
                  description: 'The region to deploy the Postgres instance to.',
                  enum: [
                    'us-east-1',
                    'us-east-2',
                    'us-west-2',
                    'ap-southeast-1',
                    'ap-southeast-2',
                    'eu-central-1',
                    'eu-west-2',
                    'sa-east-1',
                  ],
                },
              },
            },
          ],
        },
      },
    },
  },
  $defs: {
    runtimes: {
      type: 'string',
      enum: ['php-83', 'php-82', 'php-81', 'php-80', 'node-20', 'node-18', 'node-16', 'bun-1'],
    },
    matchRequirements: {
      description: 'An array of requirements that are needed to match',
      type: 'array',
      maxItems: 16,
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'value'],
            properties: {
              type: {
                description: 'The type of request element to check',
                type: 'string',
                enum: ['host'],
              },
              value: {
                description:
                  'A regular expression used to match the value. Named groups can be used in the destination',
                type: 'string',
                maxLength: 4096,
              },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'key'],
            properties: {
              type: {
                description: 'The type of request element to check',
                type: 'string',
                enum: ['header', 'cookie', 'query'],
              },
              key: {
                description: 'The name of the element contained in the particular type',
                type: 'string',
                maxLength: 4096,
              },
              value: {
                description:
                  'A regular expression used to match the value. Named groups can be used in the destination',
                type: 'string',
                maxLength: 4096,
              },
            },
          },
        ],
      },
    },
  },
};
