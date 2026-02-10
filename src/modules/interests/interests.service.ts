import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'

import { PrismaService } from 'src/prisma/prisma.service'
import { PasswordTokenType, PersonType, UserRole } from '@prisma/client'

import { ListInterestsResponseDto } from './dto/list-interests-response.dto'
import { ListInterestsDto } from './dto/list-interests.dto'
import { GrantPortalAccessDto } from './dto/grant-portal-access.dto'
import { GrantPortalAccessResponseDto } from './dto/grant-portal-access-response.dto'
import { CreateExhibitorPasswordResetTokenResponseDto } from './dto/create-exhibitor-password-reset-token-response-dto'

import { createHash, randomBytes } from 'crypto'

/**
 * Service do painel (admin) para Interessados.
 *
 * Importante:
 * - "Interessado" é o Owner (domínio).
 * - Para acesso ao portal, usamos User vinculado ao Owner via user.ownerId.
 * - O link temporário (ativação/reset) usa PasswordResetToken já existente.
 *
 * Decisão (MVP sem e-mail transacional):
 * - O admin gera um link/token e repassa ao expositor (WhatsApp/presencial/etc.).
 * - O portal consome o token via /exhibitor-auth/validate-token e /exhibitor-auth/set-password.
 */
@Injectable()
export class InterestsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------
  // Listagem do painel
  // ------------------------------------------------------------
  async list(dto: ListInterestsDto): Promise<ListInterestsResponseDto> {
    const page = dto.page ?? 1
    const pageSize = dto.pageSize ?? 20

    const skip = (page - 1) * pageSize
    const take = pageSize

    const orderBy =
      dto.sort === 'createdAt_desc'
        ? ({ createdAt: 'desc' } as const)
        : ({ updatedAt: 'desc' } as const)

    const q = dto.q?.trim()
    const qDigits = q ? this.digitsOnly(q) : ''

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
      : {}

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
    ])

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const ownerIds = rows.map((r) => r.id)

    /**
     * ✅ stallsCount em lote (evita N+1).
     */
    const stallsCounts = ownerIds.length
      ? await this.prisma.stall.groupBy({
          by: ['ownerId'],
          where: { ownerId: { in: ownerIds } },
          _count: { _all: true },
        })
      : []

    const stallsCountMap = new Map<string, number>()
    for (const g of stallsCounts) {
      stallsCountMap.set(g.ownerId, g._count._all)
    }

    /**
     * ✅ status de login do portal em lote.
     * Regra:
     * - "tem login" quando existe User EXHIBITOR vinculado ao Owner e passwordSetAt != null
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
      : []

    const hasPortalLoginMap = new Map<string, boolean>()
    for (const u of exhibitorUsers) {
      if (!u.ownerId) continue
      hasPortalLoginMap.set(u.ownerId, Boolean(u.passwordSetAt))
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
       * ✅ Badge "Com login/Sem login" no front.
       */
      hasPortalLogin: hasPortalLoginMap.get(r.id) ?? false,

      /**
       * ✅ Contagem de barracas cadastradas.
       */
      stallsCount: stallsCountMap.get(r.id) ?? 0,

      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))

    return {
      items,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    }
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
   *
   * Decisões de segurança:
   * - O banco armazena apenas hash do token (tokenHash).
   * - O token é uso único (usedAt) e expira (expiresAt).
   * - Invalida tokens ainda válidos para evitar múltiplos links ativos.
   *
   * Nota de integridade:
   * - Email de User é único no banco; por isso tratamos colisões com clareza.
   */
  async grantPortalAccess(
    ownerId: string,
    dto: GrantPortalAccessDto,
  ): Promise<GrantPortalAccessResponseDto> {
    const expiresInMinutes = dto.expiresInMinutes ?? 60
    const type = dto.type ?? PasswordTokenType.ACTIVATE_ACCOUNT

    const portalBaseUrl = process.env.PORTAL_EXHIBITOR_BASE_URL
    if (!portalBaseUrl) {
      throw new InternalServerErrorException(
        'PORTAL_EXHIBITOR_BASE_URL não configurado no ambiente.',
      )
    }

    const owner = await this.prisma.owner.findUnique({
      where: { id: ownerId },
      select: { id: true, email: true, fullName: true },
    })

    if (!owner) throw new NotFoundException('Interessado não encontrado.')

    // Regra atual: precisamos de e-mail para criar conta do portal.
    if (!owner.email) {
      throw new BadRequestException(
        'Interessado sem e-mail cadastrado. Preencha antes de liberar acesso.',
      )
    }

    /**
     * 1) Garantir/extrair o User EXHIBITOR do Owner com tratamento de colisão de e-mail.
     */
    const user = await this.getOrCreateExhibitorUserForOwner({
      ownerId: owner.id,
      ownerEmail: owner.email,
      ownerFullName: owner.fullName ?? null,
    })

    if (!user.isActive) {
      throw new BadRequestException(
        'Expositor inativo. Reative a conta antes de gerar acesso.',
      )
    }

    /**
     * 2) Emite token único (helper) e devolve link do portal.
     */
    const issued = await this.issuePortalTokenForUser({
      userId: user.id,
      type,
      expiresInMinutes,
      portalBaseUrl,
    })

    return {
      ownerId: owner.id,
      userId: user.id,
      tokenType: type,
      expiresAt: issued.expiresAt.toISOString(),
      activationLink: issued.accessLink,
    }
  }

  // ------------------------------------------------------------
  // Atalho: reset de senha (admin)
  // ------------------------------------------------------------

  /**
   * ✅ Atalho administrativo para reset de senha.
   *
   * Por que existe:
   * - UX do painel: botão direto "Resetar senha".
   *
   * Importante:
   * - Retorna token raw + link pronto para copiar.
   * - Se o expositor ainda não tiver User criado, nós criamos/garantimos o User aqui também
   *   (mantendo a regra única e evitando "reset sem conta").
   */
  async createPasswordResetToken(input: {
    ownerId: string
  }): Promise<CreateExhibitorPasswordResetTokenResponseDto> {
    const portalBaseUrl = process.env.PORTAL_EXHIBITOR_BASE_URL
    if (!portalBaseUrl) {
      throw new InternalServerErrorException(
        'PORTAL_EXHIBITOR_BASE_URL não configurado no ambiente.',
      )
    }

    const owner = await this.prisma.owner.findUnique({
      where: { id: input.ownerId },
      select: { id: true, email: true, fullName: true },
    })

    if (!owner) throw new NotFoundException('Interessado não encontrado.')

    if (!owner.email) {
      throw new BadRequestException(
        'Interessado sem e-mail cadastrado. Preencha antes de gerar reset de senha.',
      )
    }

    // ✅ Reusa a mesma lógica de garantia de usuário (evita erro de "não existe user")
    const user = await this.getOrCreateExhibitorUserForOwner({
      ownerId: owner.id,
      ownerEmail: owner.email,
      ownerFullName: owner.fullName ?? null,
    })

    if (!user.isActive) {
      throw new BadRequestException(
        'Expositor inativo. Reative a conta antes de gerar reset de senha.',
      )
    }

    const issued = await this.issuePortalTokenForUser({
      userId: user.id,
      type: PasswordTokenType.RESET_PASSWORD,
      expiresInMinutes: 30,
      portalBaseUrl,
    })

    return {
      token: issued.rawToken,
      expiresAt: issued.expiresAt.toISOString(),
      resetUrl: issued.accessLink,
    }
  }

  // ------------------------------------------------------------
  // Helpers internos (portal)
  // ------------------------------------------------------------

  /**
   * Garante um User EXHIBITOR vinculado ao Owner, tratando colisões de email (unique).
   *
   * Casos cobertos:
   * 1) Já existe user por ownerId+EXHIBITOR => reutiliza
   * 2) Não existe por ownerId:
   *    2.1) Existe por email e role != EXHIBITOR => bloqueia (email pertence ao painel/staff)
   *    2.2) Existe por email e role EXHIBITOR:
   *         - ownerId diferente => bloqueia (email já usado por outro expositor)
   *         - ownerId null => vincula ao owner (update)
   *         - ownerId igual => reutiliza
   *    2.3) Não existe por email => cria
   */
  private async getOrCreateExhibitorUserForOwner(input: {
    ownerId: string
    ownerEmail: string
    ownerFullName: string | null
  }): Promise<{ id: string; email: string; isActive: boolean; ownerId: string | null; role: UserRole }> {
    const ownerEmail = input.ownerEmail.trim().toLowerCase()

    // 1) Tenta por ownerId (caminho feliz)
    const existingByOwner = await this.prisma.user.findFirst({
      where: { ownerId: input.ownerId, role: UserRole.EXHIBITOR },
      select: { id: true, email: true, isActive: true, ownerId: true, role: true },
    })

    if (existingByOwner) {
      return existingByOwner
    }

    // 2) Tenta por email (para evitar violação do unique)
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true, email: true, isActive: true, ownerId: true, role: true },
    })

    if (existingByEmail) {
      // email pertence a um usuário do painel/staff
      if (existingByEmail.role !== UserRole.EXHIBITOR) {
        throw new BadRequestException(
          'Este e-mail já está em uso por um usuário do painel. Use outro e-mail no cadastro do expositor.',
        )
      }

      // email já usado por outro expositor
      if (existingByEmail.ownerId && existingByEmail.ownerId !== input.ownerId) {
        throw new BadRequestException(
          'Este e-mail já está em uso por outro expositor. Verifique o cadastro antes de gerar acesso.',
        )
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
          select: { id: true, email: true, isActive: true, ownerId: true, role: true },
        })
      }

      // ownerId já era o mesmo (caso raro pois não achou no findFirst, mas ok)
      return existingByEmail
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
      select: { id: true, email: true, isActive: true, ownerId: true, role: true },
    })
  }

  /**
   * Emite um token temporário para o portal:
   * - Invalida tokens antigos ainda válidos do mesmo usuário
   * - Gera rawToken + tokenHash
   * - Persiste PasswordResetToken
   * - Retorna rawToken + link pronto do portal
   *
   * Por que existe:
   * - Evitar duplicação entre "ativar conta" e "reset de senha".
   * - Garantir sempre a mesma regra de expiração e invalidação.
   */
  private async issuePortalTokenForUser(input: {
    userId: string
    type: PasswordTokenType
    expiresInMinutes: number
    portalBaseUrl: string
  }): Promise<{ rawToken: string; expiresAt: Date; accessLink: string }> {
    const expiresInMinutes = Number(input.expiresInMinutes)

    if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 5 || expiresInMinutes > 24 * 60) {
      throw new BadRequestException(
        'expiresInMinutes inválido. Informe um valor em minutos coerente.',
      )
    }

    // 1) invalida tokens antigos ainda válidos (evita múltiplos links ativos)
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: input.userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    })

    // 2) gera token raw e hash
    const rawToken = this.generateToken()
    const tokenHash = this.hashToken(rawToken)
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)

    // 3) persiste (somente hash)
    await this.prisma.passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash,
        type: input.type,
        expiresAt,
      },
      select: { id: true },
    })

    // 4) link neutro do portal (serve para ativação e reset)
    const accessLink = `${input.portalBaseUrl}/ativar?token=${encodeURIComponent(rawToken)}`

    return { rawToken, expiresAt, accessLink }
  }

  // ------------------------------------------------------------
  // Helpers internos (gerais)
  // ------------------------------------------------------------

  /**
   * Normaliza qualquer string para "somente dígitos".
   * Mantemos aqui para evitar dependência circular e deixar o caso de uso autocontido.
   */
  private digitsOnly(value: string): string {
    return (value ?? '').replace(/\D/g, '')
  }

  /**
   * Garante coerência entre personType e tamanho do documento.
   * - PF => 11 dígitos
   * - PJ => 14 dígitos
   */
  private assertPersonTypeMatchesDocument(personType: PersonType, document: string): void {
    const len = document.length

    if (personType === PersonType.PF && len !== 11) {
      throw new BadRequestException(
        'personType=PF requer document com 11 dígitos (CPF).',
      )
    }

    if (personType === PersonType.PJ && len !== 14) {
      throw new BadRequestException(
        'personType=PJ requer document com 14 dígitos (CNPJ).',
      )
    }
  }

  /**
   * Token aleatório, URL-safe.
   * 32 bytes = bom nível de entropia para token temporário.
   *
   * Decisão:
   * - base64url é mais curto que hex e continua URL-safe.
   */
  private generateToken(): string {
    return randomBytes(32).toString('base64url')
  }

  /**
   * Hash idêntico ao usado no ExhibitorAuthService.validateToken/setPassword.
   */
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex')
  }
}
