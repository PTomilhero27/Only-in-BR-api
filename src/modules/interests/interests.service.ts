// src/modules/interests/interests.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { PasswordTokenType, PersonType, UserRole } from '@prisma/client';
import { GrantPortalAccessDto } from './dto/grant-portal-access.dto';
import { GrantPortalAccessResponseDto } from './dto/grant-portal-access-response.dto';

import { randomBytes, createHash } from 'crypto';
import { ListInterestsResponseDto } from './dto/list-interests-response.dto';
import { ListInterestsDto } from './dto/list-interests.dto';

/**
 * Service do painel (admin) para Interessados.
 *
 * Importante:
 * - "Interessado" é o Owner (domínio).
 * - Para acesso ao portal, usamos User vinculado ao Owner via user.ownerId.
 * - O link temporário (ativação/reset) usa PasswordResetToken já existente.
 */
@Injectable()
export class InterestsService {
  constructor(private readonly prisma: PrismaService) {}

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

    /**
     * Where de listagem do painel.
     *
     * Decisão de UX:
     * - Busca livre por nome, e-mail, cidade e documento.
     * - Documento sempre comparado por dígitos (porque armazenamos normalizado).
     */
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

    /**
     * ✅ stallsCount em lote (evita N+1).
     */
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

    /**
     * ✅ status de login do portal em lote.
     * Regra:
     * - consideramos "tem login" quando existe User EXHIBITOR vinculado ao Owner e passwordSetAt != null
     */
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

      /**
       * ✅ NOVO
       * O front usa isso para exibir badge "Com login/Sem login".
       */
      hasPortalLogin: hasPortalLoginMap.get(r.id) ?? false,

      /**
       * ✅ NOVO
       * Contagem de barracas cadastradas pelo expositor.
       */
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

  /**
   * ✅ Ação administrativa: liberar acesso ao portal do expositor.
   *
   * O que este método faz:
   * 1) Garante que existe um Owner.
   * 2) Cria ou reaproveita um User vinculado ao Owner (role=EXHIBITOR).
   * 3) Gera um token temporário (ativação ou reset) e devolve o link para o portal.
   *
   * Decisões de segurança:
   * - O banco armazena apenas hash do token (tokenHash).
   * - O token é uso único (usedAt) e expira (expiresAt).
   */
  async grantPortalAccess(ownerId: string, dto: GrantPortalAccessDto): Promise<GrantPortalAccessResponseDto> {
    const expiresIn = dto.expiresInMinutes ?? 60;
    const type = dto.type ?? PasswordTokenType.ACTIVATE_ACCOUNT;

    // URL do portal deve vir de env/config (ex.: PORTAL_EXHIBITOR_BASE_URL).
    // Exemplo: https://portal.expositor.com
    const portalBaseUrl = process.env.PORTAL_EXHIBITOR_BASE_URL;

    const owner = await this.prisma.owner.findUnique({
      where: { id: ownerId },
      select: { id: true, email: true, fullName: true },
    });

    if (!owner) {
      throw new NotFoundException('Interessado não encontrado.');
    }

    // Regra: precisamos de email para criar conta do portal.
    // Se no seu fluxo você permitir "sem email", dá pra ajustar depois.
    if (!owner.email) {
      throw new BadRequestException('Interessado sem e-mail cadastrado. Preencha antes de liberar acesso.');
    }

    /**
     * 1) Garante um User EXHIBITOR vinculado ao Owner.
     * - Se já existir: reutiliza.
     * - Se não existir: cria com password null (primeiro acesso).
     */
    const user =
      (await this.prisma.user.findFirst({
        where: { ownerId: owner.id, role: UserRole.EXHIBITOR },
        select: { id: true, email: true },
      })) ??
      (await this.prisma.user.create({
        data: {
          name: owner.fullName ?? null,
          email: owner.email,
          role: UserRole.EXHIBITOR,
          password: null,
          isActive: true,
          passwordSetAt: null,
          ownerId: owner.id,
        },
        select: { id: true, email: true },
      }));

    /**
     * 2) Gera token raw + hash e salva PasswordResetToken.
     * Obs.: usamos uma expiração curta (30-60 min).
     */
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type,
        expiresAt,
      },
      select: { id: true },
    });

    /**
     * 3) Monta link do portal.
     * Decisão: rota única que serve para ativação e reset.
     */
    const activationLink = `${portalBaseUrl}/ativar?token=${rawToken}`;

    return {
      ownerId: owner.id,
      userId: user.id,
      tokenType: type,
      expiresAt: expiresAt.toISOString(),
      activationLink,
    };
  }

  /**
   * Normaliza qualquer string para "somente dígitos".
   * Mantemos aqui para evitar dependência circular e deixar o caso de uso autocontido.
   */
  private digitsOnly(value: string): string {
    return (value ?? '').replace(/\D/g, '');
  }

  /**
   * Garante coerência entre personType e tamanho do documento.
   * - PF => 11 dígitos
   * - PJ => 14 dígitos
   */
  private assertPersonTypeMatchesDocument(personType: PersonType, document: string): void {
    const len = document.length;

    if (personType === PersonType.PF && len !== 11) {
      throw new BadRequestException('personType=PF requer document com 11 dígitos (CPF).');
    }

    if (personType === PersonType.PJ && len !== 14) {
      throw new BadRequestException('personType=PJ requer document com 14 dígitos (CNPJ).');
    }
  }
}
