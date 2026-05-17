import { describe, expect, it, vi } from 'vitest';
import type { CredentialProvider } from './credential-provider';
import { TokenManager } from './token-manager';

const createMockProvider = (overrides?: Partial<CredentialProvider>): CredentialProvider => ({
  type: 'mock',
  getToken: vi.fn().mockResolvedValue({
    accessToken: 'token-1',
    expiresAt: Date.now() + 60_000,
  }),
  ...overrides,
});

describe('TokenManager', () => {
  it('should return a token from the provider', async () => {
    const provider = createMockProvider();
    const manager = new TokenManager(provider);

    const token = await manager.getToken();
    expect(token).toBe('token-1');
    expect(provider.getToken).toHaveBeenCalledOnce();
  });

  it('should cache the token and not call provider again within expiry', async () => {
    const provider = createMockProvider();
    const manager = new TokenManager(provider);

    await manager.getToken();
    await manager.getToken();
    await manager.getToken();

    expect(provider.getToken).toHaveBeenCalledOnce();
  });

  it('should refresh when token is expired', async () => {
    let callCount = 0;
    const provider = createMockProvider({
      getToken: vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          accessToken: `token-${callCount}`,
          expiresAt: callCount === 1 ? Date.now() - 1000 : Date.now() + 60_000,
        };
      }),
    });

    const manager = new TokenManager(provider);

    const first = await manager.getToken();
    expect(first).toBe('token-1');

    // Token is expired, should refresh
    const second = await manager.getToken();
    expect(second).toBe('token-2');
    expect(provider.getToken).toHaveBeenCalledTimes(2);
  });

  it('should never refresh a bearer token (expiresAt === null)', async () => {
    const provider = createMockProvider({
      getToken: vi.fn().mockResolvedValue({
        accessToken: 'static-token',
        expiresAt: null,
      }),
    });

    const manager = new TokenManager(provider);

    await manager.getToken();
    await manager.getToken();
    await manager.getToken();

    expect(provider.getToken).toHaveBeenCalledOnce();
  });

  it('should deduplicate concurrent getToken calls', async () => {
    const provider = createMockProvider({
      getToken: vi
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ accessToken: 'concurrent-token', expiresAt: Date.now() + 60_000 }), 50)
            )
        ),
    });

    const manager = new TokenManager(provider);

    const [t1, t2, t3] = await Promise.all([manager.getToken(), manager.getToken(), manager.getToken()]);

    expect(t1).toBe('concurrent-token');
    expect(t2).toBe('concurrent-token');
    expect(t3).toBe('concurrent-token');
    expect(provider.getToken).toHaveBeenCalledOnce();
  });

  it('should invalidate cached token', async () => {
    let callCount = 0;
    const provider = createMockProvider({
      getToken: vi.fn().mockImplementation(async () => ({
        accessToken: `token-${++callCount}`,
        expiresAt: Date.now() + 60_000,
      })),
    });

    const manager = new TokenManager(provider);

    const first = await manager.getToken();
    expect(first).toBe('token-1');

    manager.invalidate();

    const second = await manager.getToken();
    expect(second).toBe('token-2');
    expect(provider.getToken).toHaveBeenCalledTimes(2);
  });
});
