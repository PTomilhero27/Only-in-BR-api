import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { PasswordTokenType, PersonType, UserRole } from '@prisma/client';

import { ListInterestsResponseDto } from './dto/list-interests-response.dto';
import { ListInterestsDto } from './dto/list-interests.dto';
import { GrantPortalAccessDto } from './dto/grant-portal-access.dto';
import { GrantPortalAccessResponseDto } from './dto/grant-portal-access-response.dto';
import { CreateExhibitorPasswordResetTokenResponseDto } from './dto/create-exhibitor-password-reset-token-response-dto';

import { MailService } from '../mail/mail.service';
import { createHash, randomBytes } from 'crypto';

/**
 * Service do painel (admin) para Interessados.
 *
 * Importante:
 * - "Interessado" é o Owner (domínio).
 * - Para acesso ao portal, usamos User vinculado ao Owner via user.ownerId.
 * - O link temporário (ativação/reset) usa PasswordResetToken já existente.
 *
 * ✅ Agora envia email automaticamente ao gerar tokens de ativação/reset.
 */
@Injectable()
export class InterestsService {
  private readonly logger = new Logger(InterestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ------------------------------------------------------------
  // Listagem do painel
  // ------------------------------------------------------------
  async list(dto: ListInterestsDto): Promise<ListInterestsResponseDto> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const orderBy =
      dto.sort === 'createdAt_desc'
        ? ({ createdAt: 'desc' } as const)
        : ({ updatedAt: 'desc' } as const);

    const q = dto.q?.trim();
    const qDigits = q ? this.digitsOnly(q) : '';

    const where = q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { addressCity: { contains: q, mode: 'insensitive' as const } },
            ...(qDigits ? [{ document: { contains: qDigits } }] : []),
          ],
        }
      : {};

    const [totalItems, rows] = await Promise.all([
      this.prisma.owner.count({ where }),
      this.prisma.owner.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          personType: true,
          document: true,
          fullName: true,
          email: true,
          phone: true,

          addressZipcode: true,
          addressFull: true,
          addressCity: true,
          addressState: true,

          pixKey: true,
          bankName: true,
          bankAgency: true,
          bankAccount: true,
          bankAccountType: true,
          bankHolderDoc: true,
          bankHolderName: true,

          stallsDescription: true,

          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const ownerIds = rows.map((r) => r.id);

    const stallsCounts = ownerIds.length
      ? await this.prisma.stall.groupBy({
          by: ['ownerId'],
          where: { ownerId: { in: ownerIds } },
          _count: { _all: true },
        })
      : [];

    const stallsCountMap = new Map<string, number>();
    for (const g of stallsCounts) {
      stallsCountMap.set(g.ownerId, g._count._all);
    }

    const exhibitorUsers = ownerIds.length
      ? await this.prisma.user.findMany({
          where: {
            ownerId: { in: ownerIds },
            role: UserRole.EXHIBITOR,
            isActive: true,
          },
          select: {
            ownerId: true,
            passwordSetAt: true,
          },
        })
      : [];

    const hasPortalLoginMap = new Map<string, boolean>();
    for (const u of exhibitorUsers) {
      if (!u.ownerId) continue;
      hasPortalLoginMap.set(u.ownerId, Boolean(u.passwordSetAt));
    }

    const items = rows.map((r) => ({
      id: r.id,
      personType: r.personType as any,
      document: r.document,
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,

      addressZipcode: r.addressZipcode,
      addressFull: r.addressFull,
      addressCity: r.addressCity,
      addressState: r.addressState,

      pixKey: r.pixKey,
      bankName: r.bankName,
      bankAgency: r.bankAgency,
      bankAccount: r.bankAccount,
      bankAccountType: r.bankAccountType as any,
      bankHolderDoc: r.bankHolderDoc,
      bankHolderName: r.bankHolderName,

      stallsDescription: r.stallsDescription,

      hasPortalLogin: hasPortalLoginMap.get(r.id) ?? false,
      stallsCount: stallsCountMap.get(r.id) ?? 0,

      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      items,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  // ------------------------------------------------------------
  // Acesso ao portal (fonte de verdade)
  // ------------------------------------------------------------

  /**
   * ✅ Ação administrativa: liberar acesso ao portal do expositor.
   *
   * O que este método faz:
   * 1) Garante que existe um Owner.
   * 2) Cria ou reaproveita um User vinculado ao Owner (role=EXHIBITOR).
   * 3) Gera um token temporário (ativação ou reset) e devolve o link para o portal.
   * 4) ✅ Envia email para o expositor com o link de ativação/reset.
   */
  async grantPortalAccess(
    ownerId: string,
    dto: GrantPortalAccessDto,
  ): Promise<GrantPortalAccessResponseDto> {
    const expiresInMinutes = dto.expiresInMinutes ?? 60;
    const type = dto.type ?? PasswordTokenType.ACTIVATE_ACCOUNT;

    const portalBaseUrl = process.env.PORTAL_EXHIBITOR_BASE_URL;
    if (!portalBaseUrl) {
      throw new InternalServerErrorException(
        'PORTAL_EXHIBITOR_BASE_URL não configurado no ambiente.',
      );
    }

    const owner = await this.prisma.owner.findUnique({
      where: { id: ownerId },
      select: { id: true, email: true, fullName: true },
    });

    if (!owner) throw new NotFoundException('Interessado não encontrado.');

    if (!owner.email) {
      throw new BadRequestException(
        'Interessado sem e-mail cadastrado. Preencha antes de liberar acesso.',
      );
    }

    const user = await this.getOrCreateExhibitorUserForOwner({
      ownerId: owner.id,
      ownerEmail: owner.email,
      ownerFullName: owner.fullName ?? null,
    });

    if (!user.isActive) {
      throw new BadRequestException(
        'Expositor inativo. Reative a conta antes de gerar acesso.',
      );
    }

    const issued = await this.issuePortalTokenForUser({
      userId: user.id,
      type,
      expiresInMinutes,
      portalBaseUrl,
    });

    // ✅ Enviar email com o link de ativação/reset
    await this.sendPortalAccessEmail({
      email: owner.email,
      name: owner.fullName ?? '',
      link: issued.accessLink,
      type,
    });

    return {
      ownerId: owner.id,
      userId: user.id,
      tokenType: type,
      expiresAt: issued.expiresAt.toISOString(),
      activationLink: issued.accessLink,
    };
  }

  // ------------------------------------------------------------
  // Atalho: reset de senha (admin)
  // ------------------------------------------------------------

  /**
   * ✅ Atalho administrativo para reset de senha.
   * ✅ Agora envia email automaticamente com o link de reset.
   */
  async createPasswordResetToken(input: {
    ownerId: string;
  }): Promise<CreateExhibitorPasswordResetTokenResponseDto> {
    const portalBaseUrl = process.env.PORTAL_EXHIBITOR_BASE_URL;
    if (!portalBaseUrl) {
      throw new InternalServerErrorException(
        'PORTAL_EXHIBITOR_BASE_URL não configurado no ambiente.',
      );
    }

    const owner = await this.prisma.owner.findUnique({
      where: { id: input.ownerId },
      select: { id: true, email: true, fullName: true },
    });

    if (!owner) throw new NotFoundException('Interessado não encontrado.');

    if (!owner.email) {
      throw new BadRequestException(
        'Interessado sem e-mail cadastrado. Preencha antes de gerar reset de senha.',
      );
    }

    const user = await this.getOrCreateExhibitorUserForOwner({
      ownerId: owner.id,
      ownerEmail: owner.email,
      ownerFullName: owner.fullName ?? null,
    });

    if (!user.isActive) {
      throw new BadRequestException(
        'Expositor inativo. Reative a conta antes de gerar reset de senha.',
      );
    }

    const issued = await this.issuePortalTokenForUser({
      userId: user.id,
      type: PasswordTokenType.RESET_PASSWORD,
      expiresInMinutes: 30,
      portalBaseUrl,
    });

    // ✅ Enviar email com link de reset
    await this.sendPortalAccessEmail({
      email: owner.email,
      name: owner.fullName ?? '',
      link: issued.accessLink,
      type: PasswordTokenType.RESET_PASSWORD,
    });

    return {
      token: issued.rawToken,
      expiresAt: issued.expiresAt.toISOString(),
      resetUrl: issued.accessLink,
    };
  }

  // ------------------------------------------------------------
  // Helpers internos (portal)
  // ------------------------------------------------------------

  /**
   * Garante um User EXHIBITOR vinculado ao Owner, tratando colisões de email (unique).
   */
  private async getOrCreateExhibitorUserForOwner(input: {
    ownerId: string;
    ownerEmail: string;
    ownerFullName: string | null;
  }): Promise<{
    id: string;
    email: string;
    isActive: boolean;
    ownerId: string | null;
    role: UserRole;
  }> {
    const ownerEmail = input.ownerEmail.trim().toLowerCase();

    // 1) Tenta por ownerId (caminho feliz)
    const existingByOwner = await this.prisma.user.findFirst({
      where: { ownerId: input.ownerId, role: UserRole.EXHIBITOR },
      select: {
        id: true,
        email: true,
        isActive: true,
        ownerId: true,
        role: true,
      },
    });

    if (existingByOwner) {
      return existingByOwner;
    }

    // 2) Tenta por email (para evitar violação do unique)
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
      select: {
        id: true,
        email: true,
        isActive: true,
        ownerId: true,
        role: true,
      },
    });

    if (existingByEmail) {
      // email pertence a um usuário do painel/staff
      if (existingByEmail.role !== UserRole.EXHIBITOR) {
        throw new BadRequestException(
          'Este e-mail já está em uso por um usuário do painel. Use outro e-mail no cadastro do expositor.',
        );
      }

      // email já usado por outro expositor
      if (
        existingByEmail.ownerId &&
        existingByEmail.ownerId !== input.ownerId
      ) {
        throw new BadRequestException(
          'Este e-mail já está em uso por outro expositor. Verifique o cadastro antes de gerar acesso.',
        );
      }

      // expositor existe, mas ainda não estava vinculado ao Owner => vincula agora
      if (!existingByEmail.ownerId) {
        return this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            ownerId: input.ownerId,
            name: input.ownerFullName,
            email: ownerEmail,
            isActive: true,
          },
          select: {
            id: true,
            email: true,
            isActive: true,
            ownerId: true,
            role: true,
          },
        });
      }

      // ownerId já era o mesmo
      return existingByEmail;
    }

    // 3) Não existe: cria novo expositor
    return this.prisma.user.create({
      data: {
        name: input.ownerFullName,
        email: ownerEmail,
        role: UserRole.EXHIBITOR,
        password: null,
        isActive: true,
        passwordSetAt: null,
        ownerId: input.ownerId,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        ownerId: true,
        role: true,
      },
    });
  }

  /**
   * Emite um token temporário para o portal.
   */
  private async issuePortalTokenForUser(input: {
    userId: string;
    type: PasswordTokenType;
    expiresInMinutes: number;
    portalBaseUrl: string;
  }): Promise<{ rawToken: string; expiresAt: Date; accessLink: string }> {
    const expiresInMinutes = Number(input.expiresInMinutes);

    if (
      !Number.isInteger(expiresInMinutes) ||
      expiresInMinutes < 5 ||
      expiresInMinutes > 24 * 60
    ) {
      throw new BadRequestException(
        'expiresInMinutes inválido. Informe um valor em minutos coerente.',
      );
    }

    // 1) invalida tokens antigos ainda válidos
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: input.userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    // 2) gera token raw e hash
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // 3) persiste (somente hash)
    await this.prisma.passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash,
        type: input.type,
        expiresAt,
      },
      select: { id: true },
    });

    // 4) link neutro do portal
    const accessLink = `${input.portalBaseUrl}/ativar?token=${encodeURIComponent(rawToken)}`;

    return { rawToken, expiresAt, accessLink };
  }

  // ------------------------------------------------------------
  // Helpers internos (email)
  // ------------------------------------------------------------

  /**
   * ✅ Envia email com link de ativação ou reset de senha para o expositor.
   */
  private async sendPortalAccessEmail(input: {
    email: string;
    name: string;
    link: string;
    type: PasswordTokenType;
  }): Promise<void> {
    const displayName = input.name || 'Expositor';
    const isActivation = input.type === PasswordTokenType.ACTIVATE_ACCOUNT;

    const subject = isActivation
      ? 'Ativar conta — Only in BR'
      : 'Redefinir senha — Only in BR';

    const title = isActivation ? 'Ativar sua conta' : 'Redefinir sua senha';

    const description = isActivation
      ? 'Sua conta no portal foi liberada! Clique no botão abaixo para ativar sua conta e definir sua senha:'
      : 'Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:';

    const buttonText = isActivation
      ? 'Ativar minha conta'
      : 'Redefinir minha senha';

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">only in BR</h1>
          <div style="width: 40px; height: 3px; background: linear-gradient(90deg, #e94560, #0f3460); margin: 12px auto;"></div>
          <p style="color: #666; font-size: 14px; margin-top: 8px;">${title}</p>
        </div>

        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Olá, <strong>${displayName}</strong>!
        </p>

        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          ${description}
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${input.link}"
             style="display: inline-block; background: linear-gradient(135deg, #e94560, #0f3460); color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 40px; border-radius: 8px;">
            ${buttonText}
          </a>
        </div>

        <p style="color: #777; font-size: 13px; text-align: center;">
          Este link é de uso único e tem validade limitada.
        </p>

        <p style="color: #999; font-size: 12px; line-height: 1.5;">
          Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
          <span style="color: #0f3460; word-break: break-all;">${input.link}</span>
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />

        <p style="color: #999; font-size: 12px; text-align: center; line-height: 1.5;">
          Se você não solicitou esta ação, ignore este e-mail.<br />
          © ${new Date().getFullYear()} Only in BR — Todos os direitos reservados.
        </p>
      </div>
    `;

    const sent = await this.mail.sendMail(input.email, subject, html);

    if (!sent) {
      this.logger.warn(
        `Email de ${isActivation ? 'ativação' : 'reset'} não enviado para ${input.email}.`,
      );
    }
  }

  // ------------------------------------------------------------
  // Helpers internos (gerais)
  // ------------------------------------------------------------

  private digitsOnly(value: string): string {
    return (value ?? '').replace(/\D/g, '');
  }

  private assertPersonTypeMatchesDocument(
    personType: PersonType,
    document: string,
  ): void {
    const len = document.length;

    if (personType === PersonType.PF && len !== 11) {
      throw new BadRequestException(
        'personType=PF requer document com 11 dígitos (CPF).',
      );
    }

    if (personType === PersonType.PJ && len !== 14) {
      throw new BadRequestException(
        'personType=PJ requer document com 14 dígitos (CNPJ).',
      );
    }
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
