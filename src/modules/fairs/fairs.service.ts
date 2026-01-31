import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateFairDto } from './dto/create-fair-dto'
import { UpdateFairDto } from './dto/update-fair-dto'
import { ListFairsDto } from './dto/list-fair-dto'
import { AuditService } from 'src/common/audit/audit.service'

import { UpdateExhibitorStatusDto } from './dto/exhibitors/update-exhibitor-status.dto'
import { SettleInstallmentsDto } from './dto/exhibitors/settle-installments.dto'
import { AuditAction, AuditEntity, OwnerFairPaymentStatus, OwnerFairStatus } from '@prisma/client'

/**
 * Service de Feiras.
 * Responsabilidade:
 * - Encapsular regras e persistência de feiras/ocorrências
 * - Garantir consistência de retorno para o front
 *
 * Nesta etapa:
 * - Retorno de /fairs/:id/exhibitors passa a incluir resumo de pagamento
 * - Criamos ação para "baixar parcelas" (marcar como pagas)
 */
@Injectable()
export class FairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Regra de status efetivo CONCLUIDO:
   * - Pagamento completo (paymentPlan.status === PAID)
   * - Contrato assinado (contractSignedAt != null)
   * - Vinculou todas as barracas compradas (linked >= purchased)
   *
   * Mantém o status "salvo" se ainda não completou.
   */
  private computeEffectiveStatus(input: {
    savedStatus: OwnerFairStatus
    contractSignedAt: Date | null
    stallsQtyPurchased: number
    stallsQtyLinked: number
    isPaid: boolean
  }): { status: OwnerFairStatus; isComplete: boolean } {
    const isComplete =
      input.isPaid &&
      !!input.contractSignedAt &&
      input.stallsQtyLinked >= input.stallsQtyPurchased

    if (isComplete) {
      return { status: OwnerFairStatus.CONCLUIDO, isComplete: true }
    }

    return { status: input.savedStatus, isComplete: false }
  }

  /**
   * Normaliza um resumo do plano de pagamento para a UI.
   * Decisão:
   * - Incluímos installments detalhadas para permitir modal "baixar parcelas"
   * - Se depois quiser deixar o payload mais leve, dá para remover "installments"
   *   do summary e criar endpoint de detalhe.
   */
  private toPaymentSummary(plan: any) {
    if (!plan) return null

    const now = new Date()
    const installments = Array.isArray(plan.installments) ? plan.installments : []

    const paidCount = installments.filter((i) => !!i.paidAt).length
    const overdueCount = installments.filter(
      (i) => !i.paidAt && new Date(i.dueDate) < now,
    ).length

    const nextOpen = installments
      .filter((i) => !i.paidAt)
      .sort(
        (a, b) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )[0]

    return {
      status: plan.status as OwnerFairPaymentStatus,
      totalCents: plan.totalCents,
      installmentsCount: plan.installmentsCount,
      paidCount,
      overdueCount,
      nextDueDate: nextOpen ? new Date(nextOpen.dueDate).toISOString() : null,
      dueDates: installments.map((i) => new Date(i.dueDate).toISOString()),
      installments: installments.map((i) => ({
        number: i.number,
        dueDate: new Date(i.dueDate).toISOString(),
        amountCents: i.amountCents,
        paidAt: i.paidAt ? new Date(i.paidAt).toISOString() : null,
        paidAmountCents: i.paidAmountCents ?? null,
      })),
    }
  }

  /**
   * Normaliza o retorno do Prisma para o contrato do front.
   * Mantém o payload enxuto e estável.
   *
   * Importante:
   * - Calcula:
   *   - exhibitorsCount (quantidade de vínculos OwnerFair)
   *   - stallsReserved (soma de OwnerFair.stallsQty)
   *   - stallsRemaining (capacity - reserved)
   */
  private toFairResponse(fair: any) {
    const fairForms = Array.isArray(fair.fairForms)
      ? fair.fairForms.map((ff: any) => ({
          slug: ff.form?.slug,
          name: ff.form?.name,
          active: ff.form?.active,
          enabled: ff.enabled,
          startsAt:
            ff.startsAt instanceof Date ? ff.startsAt.toISOString() : ff.startsAt,
          endsAt: ff.endsAt instanceof Date ? ff.endsAt.toISOString() : ff.endsAt,
        }))
      : undefined

    const ownerFairs = Array.isArray(fair.ownerFairs) ? fair.ownerFairs : []
    const exhibitorsCount = ownerFairs.length

    const stallsReserved = ownerFairs.reduce(
      (acc: number, x: any) => acc + (x.stallsQty ?? 0),
      0,
    )
    const stallsCapacity = Number(fair.stallsCapacity ?? 0)
    const stallsRemaining = Math.max(0, stallsCapacity - stallsReserved)

    return {
      ...fair,
      createdByName: fair.createdBy?.name ?? null,
      fairForms,
      exhibitorsCount,
      stallsCapacity,
      stallsReserved,
      stallsRemaining,
      stallsQtyTotal: stallsReserved,
      createdBy: undefined,
      ownerFairs: undefined,
    }
  }

  async create(dto: CreateFairDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const fair = await tx.fair.create({
        data: {
          name: dto.name,
          address: dto.address,
          status: dto.status,
          stallsCapacity: dto.stallsCapacity,
          createdByUserId: actorUserId,
        },
      })

      await tx.fairOccurrence.createMany({
        data: dto.occurrences.map((o) => ({
          fairId: fair.id,
          startsAt: new Date(o.startsAt),
          endsAt: new Date(o.endsAt),
        })),
      })

      const after = await tx.fair.findUnique({
        where: { id: fair.id },
        include: {
          occurrences: true,
          createdBy: { select: { name: true } },
          fairForms: {
            include: {
              form: { select: { slug: true, name: true, active: true } },
            },
          },
          ownerFairs: { select: { stallsQty: true } },
        },
      })

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.FAIR,
        entityId: fair.id,
        actorUserId,
        before: null,
        after,
      })

      return this.toFairResponse(after)
    })
  }

  async update(id: string, dto: UpdateFairDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.fair.findUnique({
        where: { id },
        include: {
          occurrences: true,
          createdBy: { select: { name: true } },
          fairForms: {
            include: {
              form: { select: { slug: true, name: true, active: true } },
            },
          },
          ownerFairs: { select: { stallsQty: true } },
        },
      })
      if (!before) throw new NotFoundException('Feira não encontrada.')

      const stallsReserved = (before.ownerFairs ?? []).reduce(
        (acc: number, x: any) => acc + (x.stallsQty ?? 0),
        0,
      )

      if (dto.stallsCapacity !== undefined && dto.stallsCapacity < stallsReserved) {
        throw new BadRequestException(
          `Capacidade inválida. Já existem ${stallsReserved} barracas reservadas nesta feira.`,
        )
      }

      await tx.fair.update({
        where: { id },
        data: dto,
      })

      const after = await tx.fair.findUnique({
        where: { id },
        include: {
          occurrences: true,
          createdBy: { select: { name: true } },
          fairForms: {
            include: {
              form: { select: { slug: true, name: true, active: true } },
            },
          },
          ownerFairs: { select: { stallsQty: true } },
        },
      })

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.FAIR,
        entityId: id,
        actorUserId,
        before,
        after,
      })

      return this.toFairResponse(after)
    })
  }

  async list(filters: ListFairsDto) {
    const fairs = await this.prisma.fair.findMany({
      where: { status: filters.status },
      orderBy: { createdAt: 'desc' },
      include: {
        occurrences: true,
        createdBy: { select: { name: true } },
        fairForms: {
          include: {
            form: { select: { slug: true, name: true, active: true } },
          },
        },
        ownerFairs: { select: { stallsQty: true } },
      },
    })

    return fairs.map((f) => this.toFairResponse(f))
  }

  /**
   * GET /fairs/:id/exhibitors
   * Responsabilidade:
   * - Retornar header da feira + lista de expositores
   * - Cada item inclui:
   *   - compra (OwnerFair + slots)
   *   - barracas vinculadas (StallFair)
   *   - status efetivo (CONCLUIDO quando cumpre regra)
   *   - resumo do pagamento (plano + parcelas)
   */
  async listExhibitorsWithStalls(fairId: string) {
    const fair = await this.prisma.fair.findUnique({
      where: { id: fairId },
      select: {
        id: true,
        name: true,
        status: true,
        address: true,
        stallsCapacity: true,
        createdAt: true,
        updatedAt: true,
        occurrences: {
          orderBy: { startsAt: 'asc' },
          select: { id: true, startsAt: true, endsAt: true },
        },
      },
    })

    if (!fair) throw new NotFoundException('Feira não encontrada.')

    const ownerFairs = await this.prisma.ownerFair.findMany({
      where: { fairId },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            personType: true,
            document: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        stallSlots: {
          select: { stallSize: true, qty: true, unitPriceCents: true },
          orderBy: { stallSize: 'asc' },
        },

        /**
         * ✅ Inclusão do plano e parcelas.
         * Isso permite a UI mostrar: pagas/total + datas + abrir modal de baixa.
         */
        paymentPlan: {
          select: {
            id: true,
            totalCents: true,
            installmentsCount: true,
            status: true,
            installments: {
              select: {
                number: true,
                dueDate: true,
                amountCents: true,
                paidAt: true,
                paidAmountCents: true,
              },
              orderBy: { number: 'asc' },
            },
          },
        },
      },
    })

    const stallsReserved = ownerFairs.reduce(
      (acc, x) => acc + (x.stallsQty ?? 0),
      0,
    )
    const stallsCapacity = Number(fair.stallsCapacity ?? 0)
    const stallsRemaining = Math.max(0, stallsCapacity - stallsReserved)

    if (ownerFairs.length === 0) {
      return {
        fair: {
          ...fair,
          stallsCapacity,
          stallsReserved,
          stallsRemaining,
          occurrences: fair.occurrences.map((o) => ({
            ...o,
            startsAt: o.startsAt.toISOString(),
            endsAt: o.endsAt.toISOString(),
          })),
          createdAt: fair.createdAt.toISOString(),
          updatedAt: fair.updatedAt.toISOString(),
        },
        items: [],
      }
    }

    const stallFairs = await this.prisma.stallFair.findMany({
      where: { fairId },
      include: {
        stall: {
          select: {
            id: true,
            ownerId: true,
            pdvName: true,
            stallType: true,
            stallSize: true,
            machinesQty: true,
            bannerName: true,
            mainCategory: true,
            teamQty: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const linkedByOwnerId = new Map<string, any[]>()
    for (const sf of stallFairs) {
      const ownerId = sf.stall.ownerId
      if (!linkedByOwnerId.has(ownerId)) linkedByOwnerId.set(ownerId, [])
      linkedByOwnerId.get(ownerId)!.push(sf.stall)
    }

    const items = ownerFairs.map((of) => {
      const linkedStalls = linkedByOwnerId.get(of.ownerId) ?? []
      const stallsQtyLinked = linkedStalls.length

      const payment = this.toPaymentSummary(of.paymentPlan)
      const isPaid = payment?.status === OwnerFairPaymentStatus.PAID

      const computed = this.computeEffectiveStatus({
        savedStatus: of.status as OwnerFairStatus,
        contractSignedAt: of.contractSignedAt,
        stallsQtyPurchased: of.stallsQty,
        stallsQtyLinked,
        isPaid: !!isPaid,
      })

      return {
        ownerFairId: of.id,
        fairId: of.fairId,
        owner: of.owner,

        stallsQtyPurchased: of.stallsQty,
        stallSlots: of.stallSlots,

        stallsQtyLinked,
        linkedStalls,

        status: computed.status,
        isComplete: computed.isComplete,

        contractSignedAt: of.contractSignedAt
          ? of.contractSignedAt.toISOString()
          : null,

        payment,
      }
    })

    return {
      fair: {
        ...fair,
        stallsCapacity,
        stallsReserved,
        stallsRemaining,
        occurrences: fair.occurrences.map((o) => ({
          ...o,
          startsAt: o.startsAt.toISOString(),
          endsAt: o.endsAt.toISOString(),
        })),
        createdAt: fair.createdAt.toISOString(),
        updatedAt: fair.updatedAt.toISOString(),
      },
      items,
    }
  }

/**
 * PATCH /fairs/:fairId/exhibitors/:ownerId/payment/installments/settle
 * Responsabilidade:
 * - Marcar OU desmarcar parcelas:
 *   - todas (payAll=true)
 *   - ou específicas (numbers=[...])
 * - Recalcular o status agregado do plano (PENDING/PARTIALLY_PAID/PAID/OVERDUE)
 * - Registrar auditoria em AuditEntity.PAYMENT
 *
 * Regra de cores (front):
 * - Verde: paidAt != null
 * - Laranja: não pago e dueDate >= hoje (comparando por dia)
 * - Vermelho: não pago e dueDate < hoje (comparando por dia)
 *
 * Decisão:
 * - Este endpoint “sobrescreve” o estado (SET_PAID / SET_UNPAID),
 *   evitando endpoints separados.
 */
async settleInstallments(
  fairId: string,
  ownerId: string,
  dto: SettleInstallmentsDto,
  actorUserId: string,
) {
  return this.prisma.$transaction(async (tx) => {
    const ownerFair = await tx.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId } },
      include: {
        paymentPlan: {
          include: { installments: { orderBy: { number: 'asc' } } },
        },
      },
    })

    if (!ownerFair) {
      throw new NotFoundException('Vínculo do expositor com a feira não encontrado.')
    }

    if (!ownerFair.paymentPlan) {
      throw new BadRequestException(
        'Este expositor ainda não possui plano de pagamento configurado.',
      )
    }

    const plan = ownerFair.paymentPlan

    /**
     * ✅ Regra opcional:
     * Se o plano estiver CANCELLED, bloqueia ações.
     * (Se você quiser permitir desfazer mesmo cancelado, remova.)
     */
    if (plan.status === OwnerFairPaymentStatus.CANCELLED) {
      throw new BadRequestException('Plano de pagamento cancelado. Ação não permitida.')
    }

    /**
     * ✅ Snapshot “before” real (recarregado) para auditoria.
     * Evita registrar objeto "vivo" mutável.
     */
    const before = await tx.ownerFairPaymentPlan.findUnique({
      where: { id: plan.id },
      include: { installments: { orderBy: { number: 'asc' } } },
    })

    const installments = plan.installments ?? []
    if (installments.length === 0) {
      throw new BadRequestException('Plano inválido: nenhuma parcela encontrada.')
    }

    // Determina quais parcelas serão afetadas
    const numbersToAffect = dto.payAll
      ? installments.map((i) => i.number)
      : Array.isArray(dto.numbers)
        ? dto.numbers
        : []

    if (!dto.payAll && numbersToAffect.length === 0) {
      throw new BadRequestException('Informe payAll=true ou numbers=[...].')
    }

    // Valida existência das parcelas no plano
    const existingNumbers = new Set(installments.map((i) => i.number))
    for (const n of numbersToAffect) {
      if (!existingNumbers.has(n)) {
        throw new BadRequestException(`Parcela ${n} não existe neste plano.`)
      }
    }

    /**
     * ✅ Ação:
     * - SET_PAID: seta paidAt e paidAmountCents
     * - SET_UNPAID: limpa paidAt/paidAmountCents
     *
     * Idempotência:
     * - só atualiza parcelas que realmente precisam mudar.
     */
    const now = new Date()

    if (dto.action === 'SET_PAID') {
      const toUpdate = installments.filter(
        (i) => numbersToAffect.includes(i.number) && !i.paidAt,
      )

      // Se nada para atualizar, retorna ok (idempotente)
      if (toUpdate.length > 0) {
        await Promise.all(
          toUpdate.map((inst) =>
            tx.ownerFairInstallment.update({
              where: { planId_number: { planId: plan.id, number: inst.number } },
              data: {
                paidAt: dto.paidAt ? new Date(dto.paidAt) : now,
                paidAmountCents: dto.paidAmountCents ?? undefined,
              },
            }),
          ),
        )
      }
    } else if (dto.action === 'SET_UNPAID') {
      const toUpdate = installments.filter(
        (i) => numbersToAffect.includes(i.number) && !!i.paidAt,
      )

      // Idempotência
      if (toUpdate.length > 0) {
        await Promise.all(
          toUpdate.map((inst) =>
            tx.ownerFairInstallment.update({
              where: { planId_number: { planId: plan.id, number: inst.number } },
              data: {
                paidAt: null,
                paidAmountCents: null,
              },
            }),
          ),
        )
      }
    } else {
      // Segurança (caso DTO não valide corretamente)
      throw new BadRequestException('Ação inválida. Use SET_PAID ou SET_UNPAID.')
    }

    /**
     * ✅ Recarrega e recalcula status do plano
     */
    const afterPlan = await tx.ownerFairPaymentPlan.findUnique({
      where: { id: plan.id },
      include: { installments: { orderBy: { number: 'asc' } } },
    })

    if (!afterPlan) {
      throw new NotFoundException('Plano de pagamento não encontrado.')
    }

    const updatedInstallments = afterPlan.installments ?? []
    const total = afterPlan.installmentsCount ?? updatedInstallments.length
    const paidCount = updatedInstallments.filter((i) => !!i.paidAt).length

    /**
     * ✅ Regra de OVERDUE alinhada ao modal:
     * "atrasado" = parcela em aberto com dueDate < hoje (comparando por dia)
     */
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const hasOverdue = updatedInstallments.some((i) => {
      if (i.paidAt) return false
      const d = i.dueDate
      const due0 = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      return due0.getTime() < today0.getTime()
    })

    let newStatus: OwnerFairPaymentStatus

    if (total > 0 && paidCount >= total) {
      newStatus = OwnerFairPaymentStatus.PAID
    } else if (hasOverdue) {
      /**
       * ✅ Se existe qualquer parcela atrasada em aberto, o status é OVERDUE,
       * mesmo que existam parcelas pagas.
       */
      newStatus = OwnerFairPaymentStatus.OVERDUE
    } else if (paidCount > 0) {
      newStatus = OwnerFairPaymentStatus.PARTIALLY_PAID
    } else {
      newStatus = OwnerFairPaymentStatus.PENDING
    }

    const updatedPlan = await tx.ownerFairPaymentPlan.update({
      where: { id: plan.id },
      data: { status: newStatus },
      include: { installments: { orderBy: { number: 'asc' } } },
    })

    await this.audit.log(tx, {
      action: AuditAction.UPDATE,
      entity: AuditEntity.PAYMENT,
      entityId: updatedPlan.id,
      actorUserId,
      before,
      after: updatedPlan,
      meta: {
        fairId,
        ownerId,
        action: dto.action,
        payAll: !!dto.payAll,
        numbers: numbersToAffect,
      },
    })

    return {
      ok: true,
      planId: updatedPlan.id,
      status: updatedPlan.status,
      installmentsCount: updatedPlan.installmentsCount,
      paidCount: updatedPlan.installments.filter((i) => !!i.paidAt).length,
    }
  })
}


  /**
   * Atualiza status do expositor dentro da feira (MVP).
   * Responsabilidade:
   * - Editar o workflow manualmente
   * - Registrar auditoria
   */
  async updateExhibitorStatus(
    fairId: string,
    ownerId: string,
    dto: UpdateExhibitorStatusDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.ownerFair.findUnique({
        where: { ownerId_fairId: { ownerId, fairId } },
      })
      if (!before)
        throw new NotFoundException(
          'Vínculo do expositor com a feira não encontrado.',
        )

      const after = await tx.ownerFair.update({
        where: { ownerId_fairId: { ownerId, fairId } },
        data: { status: dto.status },
      })

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.OWNER_FAIR,
        entityId: after.id,
        actorUserId,
        before,
        after,
      })

      return after
    })
  }
}
