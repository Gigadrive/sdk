import { z } from 'zod';
import { BaseframeOptions, getById } from '.';
import { EntitySchema, PrismaModels } from './entity';
import { json, NOT_FOUND } from './response';

export interface BaseframeRoute {
  path: string;
  method: string;
  enabled: boolean;
  operation: 'readCollection' | 'readSingle' | 'create' | 'update' | 'delete';
  schema: {
    entity: keyof PrismaModels;
    properties?: (keyof PrismaModels[keyof PrismaModels])[];
    includes?: Record<string, EntitySchema<keyof PrismaModels>>;
    filters?: (keyof PrismaModels[keyof PrismaModels])[];
    validation?: z.ZodType<Partial<PrismaModels[keyof PrismaModels]>>;
  };
}

export const getBaseframeRoutes = (options: BaseframeOptions): BaseframeRoute[] => {
  const routes = options.entities.flatMap((entity) => {
    const basePath = `/${entity.entity.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`;

    const allRoutes = [
      // Collection endpoint (GET)
      {
        path: basePath,
        method: 'GET',
        enabled: true,
        operation: 'readCollection' as const,
        schema: {
          entity: entity.entity,
          properties: entity.operations.read.properties,
          includes: entity.operations.read.include,
          filters: entity.operations.read.filterProperties,
        },
      },

      // Single resource endpoint (GET)
      {
        path: `${basePath}/:id`,
        method: 'GET',
        enabled: true,
        operation: 'readSingle' as const,
        schema: {
          entity: entity.entity,
          properties: entity.operations.read.properties,
          includes: entity.operations.read.include,
        },
      },

      // Create endpoint (POST)
      entity.operations.create && {
        path: basePath,
        method: 'POST',
        enabled: entity.operations.create.enabled,
        operation: 'create' as const,
        schema: {
          entity: entity.entity,
          properties: entity.operations.read.properties,
          validation: entity.operations.create.schema,
        },
      },

      // Update endpoint (PATCH)
      entity.operations.update && {
        path: `${basePath}/:id`,
        method: 'PATCH',
        enabled: entity.operations.update.enabled,
        operation: 'update' as const,
        schema: {
          entity: entity.entity,
          properties: entity.operations.read.properties,
          validation: entity.operations.update.schema,
        },
      },

      // Delete endpoint (DELETE)
      entity.operations.delete && {
        path: `${basePath}/:id`,
        method: 'DELETE',
        enabled: entity.operations.delete.enabled,
        operation: 'delete' as const,
        schema: {
          entity: entity.entity,
        },
      },
    ].filter((route): route is NonNullable<typeof route> => route !== undefined);

    return allRoutes.filter((route) => route.enabled);
  });

  return routes;
};

export const routeRequest = async ({
  request,
  options,
}: {
  request: Request;
  options: BaseframeOptions;
}): Promise<Response | null> => {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const routes = getBaseframeRoutes(options);

  const route = routes.find((route) => {
    return route.path === path && route.method === method;
  });

  if (!route) {
    return null;
  }

  return executeRoute(route, request, options);
};

/**
 * Extracts path parameters from a URL path based on a pattern.
 *
 * @param pattern - The URL pattern containing parameter placeholders (e.g. "/users/:id")
 * @param path - The actual URL path to extract parameters from (e.g. "/users/123")
 * @returns An object mapping parameter names to their values
 * @example
 * readPathParameters("/users/:id", "/users/123")
 * // Returns { id: "123" }
 */
export const readPathParameters = (pattern: string, path: string) => {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    }
  }

  return params;
};

export const executeRoute = async (
  route: BaseframeRoute,
  request: Request,
  options: BaseframeOptions
): Promise<Response> => {
  const pathParameters = readPathParameters(route.path, request.url);

  switch (route.operation) {
    case 'readCollection':
      return OPERATION_HANDLERS.readCollection({ request, options, route, pathParameters });
    case 'readSingle':
      return OPERATION_HANDLERS.readSingle({ request, options, route, pathParameters });
    case 'create':
      return OPERATION_HANDLERS.create({ request, options, route, pathParameters });
    case 'update':
      return OPERATION_HANDLERS.update({ request, options, route, pathParameters });
    case 'delete':
      return OPERATION_HANDLERS.delete({ request, options, route, pathParameters });
  }
};

const OPERATION_HANDLERS: Record<
  BaseframeRoute['operation'],
  (args: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
    pathParameters: Record<string, string>;
  }) => Promise<Response>
> = {
  // eslint-disable-next-line
  readCollection: async (_: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
    pathParameters: Record<string, string>;
  }) => {
    return new Response('Not implemented yet');
  },
  readSingle: async ({
    options,
    route,
    pathParameters,
  }: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
    pathParameters: Record<string, string>;
  }) => {
    const id = pathParameters.id;

    if (!id) {
      return NOT_FOUND;
    }

    const data = await getById(route.schema.entity, id, options);

    if (!data) {
      return NOT_FOUND;
    }

    return json(data);
  },
  create: async ({
    request,
    options,
    route,
    pathParameters,
  }: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
    pathParameters: Record<string, string>;
  }) => {},
  update: async ({
    request,
    options,
    route,
    pathParameters,
  }: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
    pathParameters: Record<string, string>;
  }) => {},
  delete: async ({
    request,
    options,
    route,
    pathParameters,
  }: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
    pathParameters: Record<string, string>;
  }) => {},
};
