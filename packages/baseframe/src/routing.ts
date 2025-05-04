import { z } from 'zod';
import { BaseframeOptions } from '.';
import { EntitySchema, PrismaModels } from './entity';

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

export const executeRoute = async (
  route: BaseframeRoute,
  request: Request,
  options: BaseframeOptions
): Promise<Response> => {
  switch (route.operation) {
    case 'readCollection':
      return OPERATION_HANDLERS.readCollection({ request, options, route });
    case 'readSingle':
      return OPERATION_HANDLERS.readSingle({ request, options, route });
    case 'create':
      return OPERATION_HANDLERS.create({ request, options, route });
    case 'update':
      return OPERATION_HANDLERS.update({ request, options, route });
    case 'delete':
      return OPERATION_HANDLERS.delete({ request, options, route });
  }
};

const OPERATION_HANDLERS: Record<
  BaseframeRoute['operation'],
  (args: { request: Request; options: BaseframeOptions; route: BaseframeRoute }) => Promise<Response>
> = {
  readCollection: async ({
    request,
    options,
    route,
  }: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
  }) => {},
  readSingle: async ({
    request,
    options,
    route,
  }: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
  }) => {},
  create: async ({
    request,
    options,
    route,
  }: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
  }) => {},
  update: async ({
    request,
    options,
    route,
  }: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
  }) => {},
  delete: async ({
    request,
    options,
    route,
  }: {
    request: Request;
    options: BaseframeOptions;
    route: BaseframeRoute;
  }) => {},
};
