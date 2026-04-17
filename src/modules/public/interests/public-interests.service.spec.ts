import { PersonType, UserRole } from '@prisma/client';
import { PublicInterestsService } from './public-interests.service';

describe('PublicInterestsService', () => {
  let service: PublicInterestsService;
  let prisma: {
    owner: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    emailVerificationToken: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let mail: { sendMail: jest.Mock };

  beforeEach(() => {
    prisma = {
      owner: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      emailVerificationToken: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    mail = {
      sendMail: jest.fn().mockResolvedValue(true),
    };

    service = new PublicInterestsService(prisma as never, mail as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates only the interest when password is not provided', async () => {
    const tx = {
      owner: {
        create: jest.fn().mockResolvedValue({ id: 'owner-1' }),
      },
      user: {
        create: jest.fn(),
      },
      emailVerificationToken: {
        create: jest.fn(),
      },
    };

    prisma.owner.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await service.upsert({
      personType: PersonType.PF,
      document: '123.456.789-01',
      fullName: 'Maria da Silva',
      email: 'maria@example.com',
      phone: '(11) 99999-9999',
      stallsDescription: 'Doces artesanais',
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(tx.owner.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        personType: PersonType.PF,
        document: '12345678901',
        fullName: 'Maria da Silva',
        email: 'maria@example.com',
        phone: '11999999999',
        stallsDescription: 'Doces artesanais',
      }),
    });
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.emailVerificationToken.create).not.toHaveBeenCalled();
    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(result).toEqual({
      ownerId: 'owner-1',
      message: 'Interesse cadastrado com sucesso.',
    });
  });

  it('creates exhibitor access and sends verification email when password is provided', async () => {
    const tx = {
      owner: {
        create: jest.fn().mockResolvedValue({ id: 'owner-2' }),
      },
      user: {
        create: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      emailVerificationToken: {
        create: jest.fn().mockResolvedValue({ id: 'token-1' }),
      },
    };

    prisma.owner.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await service.upsert({
      personType: PersonType.PF,
      document: '123.456.789-01',
      fullName: 'Maria da Silva',
      email: 'maria@example.com',
      phone: '(11) 99999-9999',
      password: '123456',
      stallsDescription: 'Doces artesanais',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'maria@example.com' },
      select: { id: true },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Maria da Silva',
        email: 'maria@example.com',
        password: expect.any(String),
        role: UserRole.EXHIBITOR,
        isActive: false,
        ownerId: 'owner-2',
        passwordSetAt: expect.any(Date),
      }),
    });
    expect(tx.emailVerificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        codeHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(mail.sendMail).toHaveBeenCalledWith(
      'maria@example.com',
      'Código de verificação — Only in BR',
      expect.stringContaining('Only in BR'),
    );
    expect(result).toEqual({
      ownerId: 'owner-2',
      message: 'Código de verificação enviado para seu email.',
    });
  });
});
