import { ContractsAssinafyService } from './contracts-assinafy.service';

describe('ContractsAssinafyService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      ASSINAFY_API_URL: 'https://assinafy.example.com',
      ASSINAFY_ACCOUNT_ID: 'account-123',
      ASSINAFY_API_KEY: 'api-key-123',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('ignores a filtered signer payload id when the email does not match', async () => {
    const prisma = {
      owner: { findFirst: jest.fn() },
    };

    const service = new ContractsAssinafyService(prisma as never);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'wrong-signer-id' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: [
              { id: 'correct-signer-id', email: 'target@example.com' },
              { id: 'other-signer-id', email: 'other@example.com' },
            ],
          }),
      }) as typeof fetch;

    const result = await (service as any).assinafyFindSignerByEmail(
      'target@example.com',
    );

    expect(result).toBe('correct-signer-id');
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://assinafy.example.com/accounts/account-123/signers?email=target%40example.com',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://assinafy.example.com/accounts/account-123/signers',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });
});
