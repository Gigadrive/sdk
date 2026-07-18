import type { GigadriveClient } from '@gigadrive/sdk';
import { Effect, Layer, Option } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientService } from '../../../services/api-client';
import { ProjectLinkService } from '../../../services/project-link';
import { resolveDeploymentApplication } from './index';

const organization = {
  id: 'organization-1',
  name: 'Gigadrive',
  slug: 'gigadrive',
  imageUrl: 'https://example.com/org.png',
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

const createdApplication = {
  id: 'application-1',
  organizationId: organization.id,
  name: 'nextjs-demo',
  slug: 'nextjs-demo',
  imageUrl: 'https://example.com/app.png',
  rootDirectory: null,
  defaultEnvironmentSlug: 'production',
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

const makeLayer = (options?: { organizations?: (typeof organization)[]; existingApplicationId?: string }) => {
  const listOrganizations = vi.fn().mockResolvedValue({
    items: options?.organizations ?? [organization],
    total: options?.organizations?.length ?? 1,
  });
  const createApplication = vi.fn().mockResolvedValue(createdApplication);
  const client = {
    organizations: { list: listOrganizations },
    applications: { create: createApplication },
  } as unknown as GigadriveClient;
  const save = vi.fn(() => Effect.void);

  const apiClient = Layer.succeed(ApiClientService, {
    request: <A>(run: (client: GigadriveClient) => Promise<A>) => Effect.promise(() => run(client)),
  } as unknown as ApiClientService);
  const projectLink = Layer.succeed(ProjectLinkService, {
    load: () =>
      Effect.succeed(
        options?.existingApplicationId
          ? Option.some({ applicationId: options.existingApplicationId, organizationId: organization.id })
          : Option.none()
      ),
    save,
  } as unknown as ProjectLinkService);

  return {
    layer: Layer.merge(apiClient, projectLink),
    listOrganizations,
    createApplication,
    save,
  };
};

describe('resolveDeploymentApplication', () => {
  it('uses an explicit application without reading or changing remote state', async () => {
    const services = makeLayer();

    const applicationId = await resolveDeploymentApplication({
      app: Option.some('explicit-app'),
      org: Option.none(),
      name: Option.none(),
      cwd: '/workspace/nextjs-demo',
    }).pipe(Effect.provide(services.layer), Effect.runPromise);

    expect(applicationId).toBe('explicit-app');
    expect(services.listOrganizations).not.toHaveBeenCalled();
    expect(services.createApplication).not.toHaveBeenCalled();
    expect(services.save).not.toHaveBeenCalled();
  });

  it('reuses an existing project link', async () => {
    const services = makeLayer({ existingApplicationId: 'linked-app' });

    const applicationId = await resolveDeploymentApplication({
      app: Option.none(),
      org: Option.none(),
      name: Option.none(),
      cwd: '/workspace/nextjs-demo',
    }).pipe(Effect.provide(services.layer), Effect.runPromise);

    expect(applicationId).toBe('linked-app');
    expect(services.listOrganizations).not.toHaveBeenCalled();
    expect(services.createApplication).not.toHaveBeenCalled();
    expect(services.save).not.toHaveBeenCalled();
  });

  it('creates and links an application in the sole organization with an inferred name', async () => {
    const services = makeLayer();

    const applicationId = await resolveDeploymentApplication({
      app: Option.none(),
      org: Option.none(),
      name: Option.none(),
      cwd: '/workspace/nextjs-demo',
    }).pipe(Effect.provide(services.layer), Effect.runPromise);

    expect(applicationId).toBe(createdApplication.id);
    expect(services.createApplication).toHaveBeenCalledWith({
      organizationId: organization.id,
      name: 'nextjs-demo',
    });
    expect(services.save).toHaveBeenCalledWith('/workspace/nextjs-demo', {
      applicationId: createdApplication.id,
      organizationId: organization.id,
    });
  });

  it('uses explicit organization and application name options during automatic creation', async () => {
    const secondOrganization = { ...organization, id: 'organization-2', name: 'Other', slug: 'other' };
    const services = makeLayer({ organizations: [organization, secondOrganization] });

    await resolveDeploymentApplication({
      app: Option.none(),
      org: Option.some(secondOrganization.id),
      name: Option.some('Storefront'),
      cwd: '/workspace/nextjs-demo',
    }).pipe(Effect.provide(services.layer), Effect.runPromise);

    expect(services.createApplication).toHaveBeenCalledWith({
      organizationId: secondOrganization.id,
      name: 'Storefront',
    });
  });

  it('fails without creating an application when the requested organization is unavailable', async () => {
    const services = makeLayer({ organizations: [organization] });

    const result = await resolveDeploymentApplication({
      app: Option.none(),
      org: Option.some('missing-organization'),
      name: Option.none(),
      cwd: '/workspace/nextjs-demo',
    }).pipe(Effect.provide(services.layer), Effect.either, Effect.runPromise);

    expect(result).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'NoOrganizationsFoundError' },
    });
    expect(services.createApplication).not.toHaveBeenCalled();
    expect(services.save).not.toHaveBeenCalled();
  });
});
