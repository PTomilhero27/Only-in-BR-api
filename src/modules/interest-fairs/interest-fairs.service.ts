// src/modules/interest-fairs/interest-fairs.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import type { JwtPayload } from 'src/common/types/jwt-payload.type'
import {
  AuditAction,
  AuditEntity,
  OwnerFairPaymentStatus,
  Prisma,
  StallSize,
} from '@prisma/client'

import { LinkInterestToFairDto } from './dto/link-interest-to-fair.dto'
import { PatchOwnerFairPurchasesDto } from './dto/patch-owner-fair-purchases.dto'

/**
 * ✅ InterestFairsService (ADMIN)
 *
 * Responsabilidade:
 * - Criar/remover vínculo Owner↔Fair (OwnerFair)
 * - No momento da criação, registrar as compras 1 por 1 (OwnerFairPurchase) e parcelas
 *
 * Decisões importantes:
 * - Cada compra é uma linha independente (não agrupar)
 * - Para simplificar controle financeiro, forçamos qty = 1 por compra
 * - Atualizamos OwnerFair.stallsQty = número de compras (linhas)
 */
@Injectable()
export class InterestFairsService {
  constructor(private readonly prisma: PrismaService) { }

  // ---------------------------------------------
  // Helpers
  // ---------------------------------------------
  private toAuditJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue
  }

  /**
   * Esperado: YYYY-MM-DD (date-only)
   * Armazenamos como Date em UTC 00:00:00 para padronizar.
   */
  private parseDateOnlyOrThrow(value: string, fieldName: string): Date {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(`Informe ${fieldName}.`)
    }

    const iso = `${value}T00:00:00.000Z`
    const d = new Date(iso)

    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${fieldName} inválido: "${value}".`)
    }

    return d
  }

  /**
   * Status financeiro para uma compra (OwnerFairPurchase).
   * - Se total == paid => PAID
   * - Senão:
   *   - Se há parcelas vencidas não pagas => OVERDUE
   *   - Se algumas parcelas pagas => PARTIALLY_PAID
   *   - Caso contrário => PENDING
   */
  private computePurchasePaymentStatus(input: {
    totalCents: number
    paidCents: number
    installments: Array<{ dueDate: Date; paidAt: Date | null }>
  }): OwnerFairPaymentStatus {
    const remaining = Math.max(0, input.totalCents - input.paidCents)
    if (remaining === 0) return OwnerFairPaymentStatus.PAID

    const total = input.installments.length
    if (total === 0) return OwnerFairPaymentStatus.PENDING

    const now = new Date()
    const paid = input.installments.filter((i) => !!i.paidAt).length
    const anyOverdue = input.installments.some((i) => !i.paidAt && i.dueDate < now)

    if (paid === 0) {
      return anyOverdue ? OwnerFairPaymentStatus.OVERDUE : OwnerFairPaymentStatus.PENDING
    }

    if (paid < total) {
      return anyOverdue ? OwnerFairPaymentStatus.OVERDUE : OwnerFairPaymentStatus.PARTIALLY_PAID
    }

    return OwnerFairPaymentStatus.PAID
  }

  /**
   * Valida uma compra linha 1 por 1.
   *
   * Regras (Admin):
   * - qty é forçado como 1 (não vem do DTO).
   * - totalCents = unitPriceCents
   * - paidCents: 0..totalCents
   * - remaining = totalCents - paidCents
   * - installmentsCount: 0..12
   *   - Se remaining == 0 => installmentsCount deve ser 0 e installments vazio
   *   - Se remaining > 0  => installmentsCount > 0 e installments obrigatório com soma == remaining
   */
  private validatePurchaseLineOrThrow(input: {
    unitPriceCents: number
    paidCents?: number
    installmentsCount?: number
    installments?: Array<{
      number: number
      dueDate: string
      amountCents: number
      paidAt?: string | null
      paidAmountCents?: number | null
    }>
  }) {
    const qty = 1
    const unitPriceCents = Number(input.unitPriceCents)
    const paidCents = Number(input.paidCents ?? 0)
    const installmentsCount = Number(input.installmentsCount ?? 0)

    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
      throw new BadRequestException('unitPriceCents deve ser inteiro >= 0.')
    }

    const totalCents = qty * unitPriceCents

    if (!Number.isInteger(paidCents) || paidCents < 0) {
      throw new BadRequestException('paidCents deve ser inteiro >= 0.')
    }
    if (paidCents > totalCents) {
      throw new BadRequestException('paidCents não pode ser maior que o valor da barraca.')
    }

    if (!Number.isInteger(installmentsCount) || installmentsCount < 0 || installmentsCount > 12) {
      throw new BadRequestException('installmentsCount deve ser inteiro entre 0 e 12.')
    }

    const remaining = totalCents - paidCents

    // ✅ Sem restante => não pode parcelar
    if (remaining === 0) {
      if (installmentsCount !== 0) {
        throw new BadRequestException('Sem restante: installmentsCount deve ser 0.')
      }
      if (input.installments && input.installments.length > 0) {
        throw new BadRequestException('Sem restante: installments deve estar vazio.')
      }

      return {
        qty,
        unitPriceCents,
        totalCents,
        paidCents,
        installmentsCount: 0,
        installmentsParsed: [] as Array<{
          number: number
          dueDate: Date
          amountCents: number
          paidAt: Date | null
          paidAmountCents: number | null
        }>,
        status: OwnerFairPaymentStatus.PAID,
      }
    }

    // ✅ Tem restante => precisa parcelar
    if (installmentsCount === 0) {
      throw new BadRequestException(
        'Existe valor restante: informe installmentsCount > 0 e a lista de parcelas.',
      )
    }

    if (!Array.isArray(input.installments) || input.installments.length !== installmentsCount) {
      throw new BadRequestException('A lista de parcelas não confere com installmentsCount.')
    }

    const seen = new Set<number>()
    let sum = 0

    const installmentsParsed = input.installments.map((ins) => {
      const number = Number(ins.number)
      if (!Number.isInteger(number) || number < 1 || number > installmentsCount) {
        throw new BadRequestException('Cada parcela deve ter number válido (1..N).')
      }
      if (seen.has(number)) {
        throw new BadRequestException('Não é permitido repetir number de parcela.')
      }
      seen.add(number)

      const dueDate = this.parseDateOnlyOrThrow(ins.dueDate, 'dueDate')

      const amountCents = Number(ins.amountCents)
      if (!Number.isInteger(amountCents) || amountCents < 0) {
        throw new BadRequestException('amountCents deve ser inteiro >= 0.')
      }
      sum += amountCents

      const paidAt = ins.paidAt ? this.parseDateOnlyOrThrow(ins.paidAt, 'paidAt') : null

      let paidAmountCents: number | null = null
      if (ins.paidAmountCents != null) {
        const v = Number(ins.paidAmountCents)
        if (!Number.isInteger(v) || v < 0) {
          throw new BadRequestException('paidAmountCents deve ser inteiro >= 0.')
        }
        paidAmountCents = v
      }

      return { number, dueDate, amountCents, paidAt, paidAmountCents }
    })

    if (sum !== remaining) {
      throw new BadRequestException(
        `A soma das parcelas (${sum}) deve ser igual ao restante (${remaining}).`,
      )
    }

    const status = this.computePurchasePaymentStatus({
      totalCents,
      paidCents,
      installments: installmentsParsed.map((i) => ({ dueDate: i.dueDate, paidAt: i.paidAt })),
    })

    return {
      qty,
      unitPriceCents,
      totalCents,
      paidCents,
      installmentsCount,
      installmentsParsed,
      status,
    }
  }

  // ---------------------------------------------
  // List
  // ---------------------------------------------
  async listByOwner(ownerId: string) {
    const owner = await this.prisma.owner.findUnique({ where: { id: ownerId } })
    if (!owner) throw new NotFoundException('Interessado não encontrado.')

    const links = await this.prisma.ownerFair.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        fair: { select: { id: true, name: true } },

        // ✅ compras feitas no admin (linhas 1 por 1)
        ownerFairPurchases: {
          orderBy: { createdAt: 'asc' },
          include: {
            installments: { orderBy: { number: 'asc' } },
          },
        },

        // ✅ barracas já vinculadas (portal), consumindo compras
        stallFairs: {
          orderBy: { createdAt: 'asc' },
          include: {
            stall: {
              select: { id: true, pdvName: true, stallSize: true, stallType: true },
            },
            purchase: {
              select: { id: true, stallSize: true, unitPriceCents: true, qty: true, usedQty: true },
            },
          },
        },
      },
    } as const)

    return {
      ownerId,
      items: links.map((l) => ({
        ownerFairId: l.id,
        fairId: l.fairId,
        fairName: l.fair.name,
        stallsQty: l.stallsQty,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),

        purchases: l.ownerFairPurchases.map((p) => ({
          id: p.id,
          stallSize: p.stallSize,
          qty: p.qty,
          usedQty: p.usedQty,
          unitPriceCents: p.unitPriceCents,
          totalCents: p.totalCents,
          paidCents: p.paidCents,
          paidAt: p.paidAt ? p.paidAt.toISOString().slice(0, 10) : null,
          installmentsCount: p.installmentsCount,
          status: p.status,
          installments: p.installments.map((i) => ({
            number: i.number,
            dueDate: i.dueDate.toISOString().slice(0, 10),
            amountCents: i.amountCents,
            paidAt: i.paidAt ? i.paidAt.toISOString().slice(0, 10) : null,
            paidAmountCents: i.paidAmountCents ?? null,
          })),
        })),

        stalls: l.stallFairs.map((sf) => ({
          stallFairId: sf.id,
          stallId: sf.stallId,
          stallName: sf.stall.pdvName,
          stallSize: sf.stall.stallSize,
          stallType: sf.stall.stallType,
          purchaseId: sf.purchaseId,
          purchase: {
            id: sf.purchase.id,
            stallSize: sf.purchase.stallSize,
            unitPriceCents: sf.purchase.unitPriceCents,
            qty: sf.purchase.qty,
            usedQty: sf.purchase.usedQty,
          },
          createdAt: sf.createdAt.toISOString(),
        })),
      })),
    }
  }

  // ---------------------------------------------
  // Create: vínculo + compras (transação)
  // ---------------------------------------------
  async link(ownerId: string, dto: LinkInterestToFairDto, actor: JwtPayload) {
    const [owner, fair] = await Promise.all([
      this.prisma.owner.findUnique({ where: { id: ownerId } }),
      this.prisma.fair.findUnique({ where: { id: dto.fairId } }),
    ])

    if (!owner) throw new NotFoundException('Interessado não encontrado.')
    if (!fair) throw new NotFoundException('Feira não encontrada.')

    // ✅ não permite duplicar vínculo
    const existing = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId: dto.fairId } },
      select: { id: true },
    })
    if (existing) {
      throw new ConflictException('Este interessado já está vinculado a esta feira.')
    }

    // ✅ valida capacidade (se stallsCapacity > 0)
    const purchasesCount = dto.purchases.length
    if (fair.stallsCapacity > 0) {
      const reservedAgg = await this.prisma.ownerFair.aggregate({
        where: { fairId: dto.fairId },
        _sum: { stallsQty: true },
      })
      const reserved = reservedAgg._sum.stallsQty ?? 0
      const wouldReserve = reserved + purchasesCount

      if (wouldReserve > fair.stallsCapacity) {
        throw new BadRequestException(
          `Capacidade excedida: reservado=${wouldReserve}, capacidade=${fair.stallsCapacity}.`,
        )
      }
    }

    // ✅ pré-valida todas as compras (para falhar antes de começar a transação)
    const validated = dto.purchases.map((p) => {
      const v = this.validatePurchaseLineOrThrow({
        unitPriceCents: p.unitPriceCents,
        paidCents: p.paidCents,
        installmentsCount: p.installmentsCount,
        installments: p.installments,
      })

      return {
        stallSize: p.stallSize,
        ...v,
      }
    })

    // ✅ transação: cria OwnerFair + cria purchases + cria installments + auditoria
    const created = await this.prisma.$transaction(async (tx) => {
      const ownerFair = await tx.ownerFair.create({
        data: {
          ownerId,
          fairId: dto.fairId,
          stallsQty: purchasesCount, // fonte de verdade do admin: quantidade comprada
        },
      })

      // Auditoria do vínculo
      await tx.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entity: AuditEntity.OWNER_FAIR,
          entityId: ownerFair.id,
          actorUserId: actor.id,
          before: this.toAuditJson({}),
          after: this.toAuditJson({
            ownerId,
            fairId: dto.fairId,
            stallsQty: purchasesCount,
          }),
        },
      })

      // Cria cada compra como uma linha independente
      for (const p of validated) {
        const purchase = await tx.ownerFairPurchase.create({
          data: {
            ownerFairId: ownerFair.id,
            stallSize: p.stallSize,
            qty: p.qty, // sempre 1
            unitPriceCents: p.unitPriceCents,
            totalCents: p.totalCents,
            paidCents: p.paidCents,
            installmentsCount: p.installmentsCount,
            status: p.status,
            paidAt: p.status === OwnerFairPaymentStatus.PAID ? new Date() : null,
            usedQty: 0,
          },
        })

        // cria parcelas (se houver)
        if (p.installmentsCount > 0) {
          await tx.ownerFairPurchaseInstallment.createMany({
            data: p.installmentsParsed.map((ins) => ({
              purchaseId: purchase.id,
              number: ins.number,
              dueDate: ins.dueDate,
              amountCents: ins.amountCents,
              paidAt: ins.paidAt,
              paidAmountCents: ins.paidAmountCents,
            })),
          })
        }

        // Auditoria da compra (linha)
        await tx.auditLog.create({
          data: {
            action: AuditAction.CREATE,
            entity: AuditEntity.OWNER_FAIR_PURCHASE,
            entityId: purchase.id,
            actorUserId: actor.id,
            before: this.toAuditJson({}),
            after: this.toAuditJson({
              ownerFairId: ownerFair.id,
              stallSize: p.stallSize,
              qty: p.qty,
              unitPriceCents: p.unitPriceCents,
              totalCents: p.totalCents,
              paidCents: p.paidCents,
              installmentsCount: p.installmentsCount,
              status: p.status,
            }),
            meta: this.toAuditJson({
              ownerId,
              fairId: dto.fairId,
            }),
          },
        })
      }

      // Retorna o vínculo já completo (para o front renderizar imediatamente)
      const full = await tx.ownerFair.findUnique({
        where: { id: ownerFair.id },
        include: {
          fair: { select: { id: true, name: true, stallsCapacity: true } },
          ownerFairPurchases: {
            orderBy: { createdAt: 'asc' },
            include: { installments: { orderBy: { number: 'asc' } } },
          },
        },
      })

      return full
    })

    return created
  }

  /**
   * ✅ Remove vínculo (HARD REMOVE)
   *
   * Responsabilidade:
   * - Remover COMPLETAMENTE tudo do expositor naquela feira:
   *   - StallFair (barracas vinculadas)
   *   - Compras + parcelas + histórico de pagamentos
   *   - Contrato + assinatura (Contract / OwnerFair.contractSignedAt)
   *   - Aditivo (OwnerFairAddendum)
   *   - Vínculo âncora (OwnerFair)
   *
   * Por que essa ordem?
   * - StallFair.purchaseId usa onDelete: Restrict => precisamos apagar StallFair primeiro.
   * - OwnerFairPurchase -> Installments -> Payments estão em cascade => deleteMany de Purchase limpa tudo.
   * - Contract/Addendum estão em cascade a partir do OwnerFair => deletar OwnerFair limpa.
   */
  async remove(ownerId: string, fairId: string, actor: JwtPayload) {
    const existing = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId } },
      include: {
        stallFairs: { select: { id: true } },
        ownerFairPurchases: { select: { id: true } },
        contract: { select: { id: true, assinafyDocumentId: true } },
        addendum: { select: { id: true } },
      },
    })

    if (!existing) throw new NotFoundException('Vínculo não encontrado.')

    // ✅ snapshot mínimo (auditoria)
    const before = {
      ownerFairId: existing.id,
      ownerId,
      fairId,
      stallsQty: existing.stallsQty,
      status: existing.status,
      contractSignedAt: existing.contractSignedAt
        ? existing.contractSignedAt.toISOString()
        : null,
      counts: {
        stallFairs: existing.stallFairs.length,
        purchases: existing.ownerFairPurchases.length,
        hasContract: !!existing.contract,
        hasAddendum: !!existing.addendum,
      },
      contract: existing.contract
        ? {
          id: existing.contract.id,
          assinafyDocumentId: existing.contract.assinafyDocumentId ?? null,
        }
        : null,
    }

    // ✅ transação para garantir consistência
    await this.prisma.$transaction(async (tx) => {
      // 1) Remove barracas vinculadas (precisa vir antes por causa do Restrict em purchaseId)
      if (existing.stallFairs.length > 0) {
        await tx.stallFair.deleteMany({
          where: { ownerFairId: existing.id },
        })
      }

      // 2) Remove compras (cascade remove parcelas e payments)
      if (existing.ownerFairPurchases.length > 0) {
        await tx.ownerFairPurchase.deleteMany({
          where: { ownerFairId: existing.id },
        })
      }

      // 3) Remove o vínculo âncora (cascade remove Contract e OwnerFairAddendum)
      await tx.ownerFair.delete({
        where: { id: existing.id },
      })

      // 4) Auditoria
      await tx.auditLog.create({
        data: {
          action: AuditAction.DELETE,
          entity: AuditEntity.OWNER_FAIR,
          entityId: existing.id,
          actorUserId: actor.id,
          before: this.toAuditJson(before),
          after: this.toAuditJson({ ok: true }),
          meta: this.toAuditJson({
            mode: 'hard_remove',
            removed: {
              stallFairs: before.counts.stallFairs,
              purchases: before.counts.purchases,
              contract: before.counts.hasContract,
              addendum: before.counts.hasAddendum,
            },
          }),
        },
      })
    })

    return { ok: true }
  }

  /**
 * ✅ PATCH purchases (replace total)
 *
 * Responsabilidade:
 * - Validar vínculo Owner↔Fair
 * - Bloquear se já houve consumo (usedQty > 0 OU existe StallFair)
 * - Apagar todas as compras antigas (cascade nas parcelas)
 * - Recriar compras e parcelas (1 por 1)
 * - Recalcular OwnerFair.stallsQty
 * - Registrar auditoria OWNER_FAIR_PURCHASE
 */

  async patchPurchasesReplaceTotal(
    ownerId: string,
    fairId: string,
    dto: PatchOwnerFairPurchasesDto,
    actor: JwtPayload,
  ) {
    // 1) valida vínculo
    const ownerFair = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId } },
      include: {
        ownerFairPurchases: {
          include: { installments: true },
          orderBy: { createdAt: 'asc' },
        },
        stallFairs: { select: { id: true } },
      },
    })

    if (!ownerFair) throw new NotFoundException('Vínculo não encontrado.')

    // 2) bloqueio por consumo
    const anyConsumed = ownerFair.ownerFairPurchases.some((p) => (p.usedQty ?? 0) > 0)
    const hasStallFairs = (ownerFair.stallFairs?.length ?? 0) > 0

    if (anyConsumed || hasStallFairs) {
      throw new ConflictException(
        'Não é possível editar compras após vincular barracas à feira (consumo detectado).',
      )
    }

    // 3) snapshot "before" para auditoria
    const beforeSnapshot = {
      ownerFairId: ownerFair.id,
      stallsQty: ownerFair.stallsQty,
      purchases: ownerFair.ownerFairPurchases.map((p) => ({
        id: p.id,
        stallSize: p.stallSize,
        qty: p.qty,
        unitPriceCents: p.unitPriceCents,
        totalCents: p.totalCents,
        paidCents: p.paidCents,
        installmentsCount: p.installmentsCount,
        status: p.status,
        usedQty: p.usedQty,
        installments: p.installments.map((i) => ({
          number: i.number,
          dueDate: i.dueDate.toISOString().slice(0, 10),
          amountCents: i.amountCents,
          paidAt: i.paidAt ? i.paidAt.toISOString().slice(0, 10) : null,
          paidAmountCents: i.paidAmountCents ?? null,
        })),
      })),
    }

    // 4) validações de negócio (por linha)
    // Decisão: 1 por 1 => qty = 1 sempre.
    const normalized = dto.purchases.map((line, idx) => {
      const unitPriceCents = Number(line.unitPriceCents ?? 0)
      const paidCents = Number(line.paidCents ?? 0)
      const count = Number(line.installmentsCount ?? 0)

      if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
        throw new BadRequestException(`Linha ${idx + 1}: unitPriceCents inválido.`)
      }
      if (!Number.isInteger(paidCents) || paidCents < 0) {
        throw new BadRequestException(`Linha ${idx + 1}: paidCents inválido.`)
      }
      if (paidCents > unitPriceCents) {
        throw new BadRequestException(`Linha ${idx + 1}: paidCents não pode ser maior que unitPriceCents.`)
      }
      if (!Number.isInteger(count) || count < 0 || count > 12) {
        throw new BadRequestException(`Linha ${idx + 1}: installmentsCount deve ser entre 0 e 12.`)
      }

      const totalCents = unitPriceCents // qty=1
      const remaining = totalCents - paidCents

      // Se quitou => não pode ter parcelas
      if (remaining === 0) {
        if (count !== 0) {
          throw new BadRequestException(`Linha ${idx + 1}: sem restante => installmentsCount deve ser 0.`)
        }
        if (line.installments?.length) {
          throw new BadRequestException(`Linha ${idx + 1}: sem restante => installments deve estar vazio.`)
        }
        return {
          stallSize: line.stallSize,
          unitPriceCents,
          totalCents,
          paidCents,
          installmentsCount: 0,
          installments: [],
          status: OwnerFairPaymentStatus.PAID,
        }
      }

      // Se falta pagar => precisa parcelamento (por enquanto)
      if (count === 0) {
        throw new BadRequestException(
          `Linha ${idx + 1}: existe restante (${remaining}) => informe installmentsCount > 0 e a lista de parcelas.`,
        )
      }

      if (!Array.isArray(line.installments) || line.installments.length !== count) {
        throw new BadRequestException(`Linha ${idx + 1}: installments não confere com installmentsCount.`)
      }

      // valida soma parcelas == restante e numbers únicos 1..N
      const seen = new Set<number>()
      let sum = 0

      const installmentsParsed = line.installments.map((ins) => {
        const number = Number(ins.number)
        if (!Number.isInteger(number) || number < 1 || number > count) {
          throw new BadRequestException(`Linha ${idx + 1}: parcela number inválido (1..${count}).`)
        }
        if (seen.has(number)) {
          throw new BadRequestException(`Linha ${idx + 1}: parcela number repetido (${number}).`)
        }
        seen.add(number)

        const dueDate = this.parseDateOnlyOrThrow(ins.dueDate, `Linha ${idx + 1}: dueDate`)
        const amountCents = Number(ins.amountCents)

        if (!Number.isInteger(amountCents) || amountCents < 0) {
          throw new BadRequestException(`Linha ${idx + 1}: amountCents inválido.`)
        }

        sum += amountCents

        return { number, dueDate, amountCents }
      })

      if (sum !== remaining) {
        throw new BadRequestException(
          `Linha ${idx + 1}: soma das parcelas (${sum}) deve ser igual ao restante (${remaining}).`,
        )
      }

      // status inicial (sem paidAt em parcelas no admin, mas já deixa coerente)
      const status = this.computePurchasePaymentStatus({
        totalCents,
        paidCents,
        installments: installmentsParsed.map((i) => ({
          dueDate: i.dueDate,
          paidAt: null,
        })),
      })

      return {
        stallSize: line.stallSize,
        unitPriceCents,
        totalCents,
        paidCents,
        installmentsCount: count,
        installments: installmentsParsed,
        status,
      }
    })

    // 5) transação: delete tudo e recria
    const result = await this.prisma.$transaction(async (tx) => {
      // apaga compras antigas (cascade apaga installments)
      await tx.ownerFairPurchase.deleteMany({
        where: { ownerFairId: ownerFair.id },
      })

      // recria compras (1 por 1)
      for (const p of normalized) {
        await tx.ownerFairPurchase.create({
          data: {
            ownerFairId: ownerFair.id,
            stallSize: p.stallSize as StallSize,
            qty: 1, // ✅ 1 por 1
            unitPriceCents: p.unitPriceCents,
            totalCents: p.totalCents,
            paidCents: p.paidCents,
            installmentsCount: p.installmentsCount,
            status: p.status,
            usedQty: 0, // resetado (não havia consumo)
            installments: {
              create:
                p.installmentsCount > 0
                  ? p.installments.map((i) => ({
                    number: i.number,
                    dueDate: i.dueDate,
                    amountCents: i.amountCents,
                  }))
                  : [],
            },
          },
        })
      }

      // atualiza stallsQty (quantidade comprada = número de linhas)
      const stallsQty = normalized.length

      const updatedOwnerFair = await tx.ownerFair.update({
        where: { id: ownerFair.id },
        data: { stallsQty },
        select: { id: true, stallsQty: true, ownerId: true, fairId: true },
      })

      return updatedOwnerFair
    })

    // 6) auditoria (before/after)
    const afterSnapshot = {
      ownerFairId: result.id,
      stallsQty: result.stallsQty,
      purchasesCount: normalized.length,
      purchases: normalized.map((p) => ({
        stallSize: p.stallSize,
        qty: 1,
        unitPriceCents: p.unitPriceCents,
        totalCents: p.totalCents,
        paidCents: p.paidCents,
        installmentsCount: p.installmentsCount,
        status: p.status,
        usedQty: 0,
        installments: p.installments.map((i) => ({
          number: i.number,
          dueDate: i.dueDate.toISOString().slice(0, 10),
          amountCents: i.amountCents,
        })),
      })),
    }

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entity: AuditEntity.OWNER_FAIR_PURCHASE,
        // decisão: entityId = ownerFairId, pois o "replace" altera o conjunto inteiro de compras do vínculo
        entityId: ownerFair.id,
        actorUserId: actor.id,
        before: this.toAuditJson(beforeSnapshot),
        after: this.toAuditJson(afterSnapshot),
        meta: this.toAuditJson({
          ownerId,
          fairId,
          mode: 'replace_total',
        }),
      },
    })

    return {
      ok: true,
      ownerFairId: result.id,
      stallsQty: result.stallsQty,
    }
  }
}
