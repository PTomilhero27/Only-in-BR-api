import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from 'src/common/audit/audit.service'

import { CreateFairDto } from './dto/create-fair-dto'
import { UpdateFairDto } from './dto/update-fair-dto'
import { ListFairsDto } from './dto/list-fair-dto'

import { UpdateExhibitorStatusDto } from './dto/exhibitors/update-exhibitor-status.dto'
import {
  AuditAction,
  AuditEntity,
  OwnerFairPaymentStatus,
  OwnerFairStatus,
} from '@prisma/client'
import {
  SettleInstallmentsAction,
  SettleStallInstallmentsDto,
} from './dto/exhibitors/settle-stall-installments.dto'

@Injectable()
export class FairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------
  // Helpers (datas / normalização)
  // ---------------------------------------------------------

  /**
   * Retorna a mesma data com horário zerado (00:00 local).
   * Uso:
   * - Comparações “date-only” (ex.: overdue) sem depender do horário.
   */
  private day0(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  /**
   * Normaliza uma data "pura" (YYYY-MM-DD) para Date em UTC (00:00Z),
   * evitando bugs de timezone na UI e mantendo consistência no banco.
   */
  private parseDateOnlyToUTC(dateOnly: string) {
    // "2026-02-04" -> "2026-02-04T00:00:00.000Z"
    return new Date(`${dateOnly}T00:00:00.000Z`)
  }

  // ---------------------------------------------------------
  // Helpers (regras de pagamento)
  // ---------------------------------------------------------

  /**
   * Recalcula o cache da parcela a partir do histórico:
   * - paidAmountCents = soma dos payments.amountCents
   * - paidAt = data do pagamento que QUITOU a parcela (quando soma >= amountCents), senão null
   *
   * Decisão:
   * - "paidAt" continua significando "parcela quitada".
   * - Para exibir parcial, a UI usa paidAmountCents > 0 (ou lista de payments).
   */
  private computeInstallmentCache(input: {
    installmentAmountCents: number
    payments: Array<{ paidAt: Date; amountCents: number }>
  }): { paidAmountCents: number; paidAt: Date | null } {
    const amount = Number(input.installmentAmountCents ?? 0)
    const sum = (input.payments ?? []).reduce(
      (acc, p) => acc + Number(p.amountCents ?? 0),
      0,
    )

    if (amount <= 0) return { paidAmountCents: 0, paidAt: null }

    if (sum >= amount) {
      // quando quitou, usamos a data do ÚLTIMO pagamento registrado (máxima)
      const maxPaidAt =
        input.payments
          .map((p) => p.paidAt)
          .sort((a, b) => a.getTime() - b.getTime())
          .at(-1) ?? null

      return { paidAmountCents: sum, paidAt: maxPaidAt }
    }

    return { paidAmountCents: sum, paidAt: null }
  }

  /**
   * Recalcula a compra a partir das parcelas (com cache já atualizado):
   * - paidCents: entrada derivada + soma paidAmountCents das parcelas (limitado ao total)
   * - status: PAID > OVERDUE > PARTIALLY_PAID > PENDING
   * - paidAt: quando 100% pago
   *
   * Entrada derivada:
   * - entryCents = totalCents - soma(amountCents de TODAS as parcelas)
   */
  private computePurchaseCacheFromInstallments(input: {
    totalCents: number
    installments: Array<{
      dueDate: Date
      amountCents: number
      paidAmountCents: number | null
      paidAt: Date | null
    }>
    now: Date
  }): { paidCents: number; status: OwnerFairPaymentStatus; paidAt: Date | null } {
    const total = Number(input.totalCents ?? 0)
    const installments = Array.isArray(input.installments) ? input.installments : []

    const installmentsTotal = installments.reduce(
      (acc, i) => acc + Number(i.amountCents ?? 0),
      0,
    )
    const entryCents = Math.max(0, total - installmentsTotal)

    const paidInstallments = installments.reduce((acc, i) => {
      const v = Number(i.paidAmountCents ?? 0)
      return acc + v
    }, 0)

    const paidCents = Math.min(total, entryCents + paidInstallments)

    const today0 = this.day0(input.now)
    const hasOverdue = installments.some((i) => {
      // se parcela ainda não quitou (paidAt null) e venceu
      if (i.paidAt) return false
      const due0 = this.day0(new Date(i.dueDate))
      return due0.getTime() < today0.getTime()
    })

    let status: OwnerFairPaymentStatus
    if (total > 0 && paidCents >= total) status = OwnerFairPaymentStatus.PAID
    else if (hasOverdue) status = OwnerFairPaymentStatus.OVERDUE
    else if (paidCents > 0) status = OwnerFairPaymentStatus.PARTIALLY_PAID
    else status = OwnerFairPaymentStatus.PENDING

    return {
      paidCents,
      status,
      paidAt: status === OwnerFairPaymentStatus.PAID ? input.now : null,
    }
  }

  /**
   * Recalcula:
   * - paidCents (entrada + parcelas pagas)
   * - status (PENDING/PARTIALLY_PAID/PAID/OVERDUE)
   * - paidAt (quando 100% pago)
   *
   * Decisão:
   * - Como não temos um campo "entryCents" separado, derivamos a entrada como:
   *   entryCents = totalCents - soma(amountCents de TODAS as parcelas)
   * - E então: paidCents = entryCents + soma(valor pago das parcelas quitadas)
   *
   * Isso mantém o total pago coerente mesmo quando o Admin marca/desmarca parcelas.
   */
  private computePurchaseFinancials(input: {
    totalCents: number
    installments: Array<{
      dueDate: Date
      amountCents: number
      paidAt: Date | null
      paidAmountCents: number | null
    }>
    now: Date
  }): { paidCents: number; status: OwnerFairPaymentStatus; paidAt: Date | null } {
    const totalCents = Number(input.totalCents ?? 0)
    const installments = Array.isArray(input.installments) ? input.installments : []

    const installmentsTotal = installments.reduce(
      (acc, i) => acc + Number(i.amountCents ?? 0),
      0,
    )

    // entrada derivada (pode ser 0)
    const entryCents = Math.max(0, totalCents - installmentsTotal)

    const paidInstallmentsCents = installments.reduce((acc, i) => {
      if (!i.paidAt) return acc
      const v = i.paidAmountCents ?? i.amountCents
      return acc + Number(v ?? 0)
    }, 0)

    const paidCents = Math.min(totalCents, entryCents + paidInstallmentsCents)

    const now = input.now
    const today0 = this.day0(now)

    const anyOverdue = installments.some((i) => {
      if (i.paidAt) return false
      const due0 = this.day0(new Date(i.dueDate))
      return due0.getTime() < today0.getTime()
    })

    // Status por regra: PAID > OVERDUE > PARTIALLY_PAID > PENDING
    let status: OwnerFairPaymentStatus
    if (paidCents >= totalCents && totalCents > 0) status = OwnerFairPaymentStatus.PAID
    else if (anyOverdue) status = OwnerFairPaymentStatus.OVERDUE
    else if (paidCents > 0) status = OwnerFairPaymentStatus.PARTIALLY_PAID
    else status = OwnerFairPaymentStatus.PENDING

    const paidAt = status === OwnerFairPaymentStatus.PAID ? now : null

    return { paidCents, status, paidAt }
  }

  /**
   * Pagamento agregado do expositor:
   * - agora vem de purchases (OwnerFairPurchase)
   */
  private toAggregatedPaymentFromPurchases(purchases: any[]) {
    const totalCents = purchases.reduce((acc, p) => acc + (p.totalCents ?? 0), 0)
    const paidCents = purchases.reduce((acc, p) => acc + (p.paidCents ?? 0), 0)

    const statuses: OwnerFairPaymentStatus[] = purchases.map(
      (p) => (p.status as OwnerFairPaymentStatus) ?? OwnerFairPaymentStatus.PENDING,
    )

    const anyOverdue = statuses.includes(OwnerFairPaymentStatus.OVERDUE)
    const allPaid = statuses.length > 0 && statuses.every((s) => s === OwnerFairPaymentStatus.PAID)
    const anyPaidLike = statuses.some(
      (s) => s === OwnerFairPaymentStatus.PAID || s === OwnerFairPaymentStatus.PARTIALLY_PAID,
    )

    const status = allPaid
      ? OwnerFairPaymentStatus.PAID
      : anyOverdue
        ? OwnerFairPaymentStatus.OVERDUE
        : anyPaidLike
          ? OwnerFairPaymentStatus.PARTIALLY_PAID
          : OwnerFairPaymentStatus.PENDING

    return {
      status,
      totalCents,
      paidCents,
      purchasesCount: purchases.length,
    }
  }

  /**
   * Resumo de pagamento por COMPRA (para UI / modal de parcelas).
   * (substitui o antigo "por barraca" via paymentPlan)
   */
  private toPurchasePaymentSummary(p: any) {
    const installments = Array.isArray(p.installments) ? p.installments : []

    const now = new Date()
    const today0 = this.day0(now)

    const paidCount = installments.filter((i: any) => !!i.paidAt).length
    const overdueCount = installments.filter((i: any) => {
      if (i.paidAt) return false
      const due0 = this.day0(new Date(i.dueDate))
      return due0.getTime() < today0.getTime()
    }).length

    const nextOpen = installments
      .filter((i: any) => !i.paidAt)
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

    return {
      purchaseId: p.id,
      stallSize: p.stallSize,
      qty: p.qty,
      usedQty: p.usedQty,

      unitPriceCents: p.unitPriceCents,
      totalCents: p.totalCents,

      paidCents: p.paidCents,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,

      status: p.status,

      installmentsCount: p.installmentsCount,
      paidCount,
      overdueCount,
      nextDueDate: nextOpen ? new Date(nextOpen.dueDate).toISOString() : null,

      installments: installments.map((i: any) => ({
        id: i.id,
        number: i.number,
        dueDate: new Date(i.dueDate).toISOString(),
        amountCents: i.amountCents,
        paidAt: i.paidAt ? new Date(i.paidAt).toISOString() : null,
        paidAmountCents: i.paidAmountCents ?? null,
      })),
    }
  }

  /**
   * Regra para status efetivo do expositor dentro da feira.
   * Responsabilidade:
   * - Calcular se está CONCLUIDO baseado em pagamento + contrato + barracas vinculadas
   * - Caso não esteja completo, mantém o status salvo no banco (controle operacional do Admin)
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
   * Formata a resposta da feira para o Admin (lista/crud).
   * Observação:
   * - Calcula métricas de capacidade/reservas para evitar cálculo no front.
   */
  private toFairResponse(fair: any) {
    const fairForms = Array.isArray(fair.fairForms)
      ? fair.fairForms.map((ff: any) => ({
          slug: ff.form?.slug,
          name: ff.form?.name,
          active: ff.form?.active,
          enabled: ff.enabled,
          startsAt: ff.startsAt instanceof Date ? ff.startsAt.toISOString() : ff.startsAt,
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

  // ---------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------

  /**
   * Cria uma feira + suas ocorrências.
   * Responsabilidade:
   * - Persistir Fair
   * - Persistir FairOccurrence (dias/horários não contíguos)
   * - Registrar auditoria
   */
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

  /**
   * Atualiza dados da feira.
   * Responsabilidade:
   * - Impedir reduzir capacidade abaixo de barracas já reservadas
   * - Registrar auditoria
   */
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

  /**
   * Lista feiras com filtros simples.
   */
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

  // ---------------------------------------------------------
  // GET /fairs/:id/exhibitors  (AJUSTADO p/ Purchases)
  // ---------------------------------------------------------

  /**
   * Lista expositores vinculados a uma feira.
   * Responsabilidade:
   * - Retornar:
   *   - Owner (agora completo: contato + endereço + pagamento)
   *   - Purchases e resumo de parcelas
   *   - StallFairs (barracas vinculadas + compra consumida)
   *   - Contract summary (template da feira + instância + sign url)
   * - Retornar métricas da feira (capacidade/reservas)
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
        contractSettings: {
          select: {
            id: true,
            templateId: true,
            updatedAt: true,
            updatedByUserId: true,
            template: {
              select: {
                id: true,
                title: true,
                status: true,
                isAddendum: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    })

    if (!fair) throw new NotFoundException('Feira não encontrada.')

    const ownerFairs = await this.prisma.ownerFair.findMany({
      where: { fairId },
      orderBy: { createdAt: 'desc' },
      include: {
        // ✅✅✅ AQUI ESTÁ A MUDANÇA: Owner com endereço + pagamento
        owner: {
          select: {
            id: true,
            personType: true,
            document: true,
            fullName: true,
            email: true,
            phone: true,

            // Endereço (modal "Dados" > Endereço)
            addressFull: true,
            addressCity: true,
            addressState: true,
            addressZipcode: true,
            addressNumber: true,

            // Pagamento (modal "Dados" > Pagamento)
            pixKey: true,
            bankName: true,
            bankAgency: true,
            bankAccount: true,
            bankAccountType: true,
            bankHolderDoc: true,
            bankHolderName: true,

            // Extra (útil para ficha/contrato e futuras telas)
            stallsDescription: true,
          },
        },

        stallFairs: {
          orderBy: { createdAt: 'desc' },
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
            purchase: {
              select: {
                id: true,
                stallSize: true,
                unitPriceCents: true,
                qty: true,
                usedQty: true,
                status: true,
              },
            },
          },
        },

        ownerFairPurchases: {
          orderBy: { createdAt: 'asc' },
          include: {
            installments: { orderBy: { number: 'asc' } },
          },
        },

        contract: {
          select: {
            id: true,
            templateId: true,
            addendumTemplateId: true,
            pdfPath: true,
            assinafyDocumentId: true,
            signUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },

        addendum: {
          select: {
            id: true,
            templateId: true,
            templateVersionNumber: true,
            createdAt: true,
            updatedAt: true,
            template: {
              select: {
                id: true,
                title: true,
                status: true,
                isAddendum: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    })

    const stallsReserved = ownerFairs.reduce((acc, x) => acc + (x.stallsQty ?? 0), 0)
    const stallsCapacity = Number(fair.stallsCapacity ?? 0)
    const stallsRemaining = Math.max(0, stallsCapacity - stallsReserved)

    const items = ownerFairs.map((of) => {
      const stallFairs = Array.isArray(of.stallFairs) ? of.stallFairs : []
      const purchases = Array.isArray(of.ownerFairPurchases) ? of.ownerFairPurchases : []

      const linkedStalls = stallFairs.map((sf) => sf.stall)
      const stallsQtyLinked = linkedStalls.length

      const aggregatedPayment = this.toAggregatedPaymentFromPurchases(purchases)
      const isPaid = aggregatedPayment.status === OwnerFairPaymentStatus.PAID

      const computed = this.computeEffectiveStatus({
        savedStatus: of.status as OwnerFairStatus,
        contractSignedAt: of.contractSignedAt,
        stallsQtyPurchased: of.stallsQty,
        stallsQtyLinked,
        isPaid: !!isPaid,
      })

      const signedAt = of.contractSignedAt ? of.contractSignedAt.toISOString() : null
      const signUrl =
        signedAt
          ? null
          : of.contract?.signUrl
            ? of.contract.signUrl
            : of.contract?.assinafyDocumentId
              ? `https://app.assinafy.com.br/sign/${of.contract.assinafyDocumentId}`
              : null

      const contractSummary = {
        fairTemplate: fair.contractSettings?.template
          ? {
              id: fair.contractSettings.template.id,
              title: fair.contractSettings.template.title,
              status: fair.contractSettings.template.status,
              updatedAt: fair.contractSettings.template.updatedAt.toISOString(),
            }
          : null,

        instance: of.contract
          ? {
              id: of.contract.id,
              templateId: of.contract.templateId,
              addendumTemplateId: of.contract.addendumTemplateId ?? null,
              pdfPath: of.contract.pdfPath ?? null,
              assinafyDocumentId: of.contract.assinafyDocumentId ?? null,
              createdAt: of.contract.createdAt.toISOString(),
              updatedAt: of.contract.updatedAt.toISOString(),
            }
          : null,

        addendumChoice: of.addendum
          ? {
              id: of.addendum.id,
              templateId: of.addendum.templateId,
              templateTitle: of.addendum.template?.title ?? null,
              templateStatus: of.addendum.template?.status ?? null,
              templateVersionNumber: of.addendum.templateVersionNumber,
              createdAt: of.addendum.createdAt.toISOString(),
              updatedAt: of.addendum.updatedAt.toISOString(),
            }
          : null,

        signedAt,
        signUrl,
        hasPdf: Boolean(of.contract?.pdfPath),
        hasContractInstance: Boolean(of.contract?.id),
      }

      const purchasesPayments = purchases.map((p) => this.toPurchasePaymentSummary(p))

      const stallsLinked = stallFairs.map((sf) => ({
        stallFairId: sf.id,
        stallId: sf.stallId,
        createdAt: sf.createdAt.toISOString(),
        stall: sf.stall,
        purchase: sf.purchase
          ? {
              id: sf.purchase.id,
              stallSize: sf.purchase.stallSize,
              unitPriceCents: sf.purchase.unitPriceCents,
              qty: sf.purchase.qty,
              usedQty: sf.purchase.usedQty,
              status: sf.purchase.status,
            }
          : null,
      }))

      return {
        ownerFairId: of.id,
        fairId: of.fairId,

        // ✅ agora contém endereço + pagamento
        owner: of.owner,

        stallsQtyPurchased: of.stallsQty,
        stallsQtyLinked,
        linkedStalls,

        status: computed.status,
        isComplete: computed.isComplete,

        contractSignedAt: signedAt,

        payment: aggregatedPayment,

        purchasesPayments,
        stallFairs: stallsLinked,

        contract: contractSummary,
      }
    })

    return {
      fair: {
        id: fair.id,
        name: fair.name,
        status: fair.status,
        address: fair.address,

        stallsCapacity,
        stallsReserved,
        stallsRemaining,

        occurrences: fair.occurrences.map((o) => ({
          ...o,
          startsAt: o.startsAt.toISOString(),
          endsAt: o.endsAt.toISOString(),
        })),

        contractSettings: fair.contractSettings
          ? {
              id: fair.contractSettings.id,
              templateId: fair.contractSettings.templateId,
              updatedAt: fair.contractSettings.updatedAt.toISOString(),
              updatedByUserId: fair.contractSettings.updatedByUserId ?? null,
              template: {
                id: fair.contractSettings.template.id,
                title: fair.contractSettings.template.title,
                status: fair.contractSettings.template.status,
                isAddendum: fair.contractSettings.template.isAddendum,
                updatedAt: fair.contractSettings.template.updatedAt.toISOString(),
              },
            }
          : null,

        createdAt: fair.createdAt.toISOString(),
        updatedAt: fair.updatedAt.toISOString(),
      },

      items,
    }
  }

  // ---------------------------------------------------------
  // PATCH installments (AGORA: por PURCHASE)
  // ---------------------------------------------------------

  /**
   * Atalho para marcar/desmarcar parcelas como pagas (por compra).
   * Responsabilidade:
   * - Validar se a compra pertence ao owner + fair
   * - Atualizar paidAt/paidAmountCents das parcelas
   * - Recalcular paidCents/status/paidAt da compra
   * - Registrar auditoria com meta útil
   */
  async settleStallInstallments(
    fairId: string,
    ownerId: string,
    dto: SettleStallInstallmentsDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseId = dto.purchaseId

      const purchase = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: {
          ownerFair: { select: { id: true, ownerId: true, fairId: true } },
          installments: { orderBy: { number: 'asc' } },
        },
      })

      if (!purchase) throw new NotFoundException('Compra (OwnerFairPurchase) não encontrada.')

      // ✅ segurança de consistência (evita "contratos implícitos")
      if (purchase.ownerFair.fairId !== fairId) {
        throw new BadRequestException('Compra não pertence à feira informada.')
      }
      if (purchase.ownerFair.ownerId !== ownerId) {
        throw new BadRequestException('Compra não pertence ao expositor informado.')
      }

      if (purchase.status === OwnerFairPaymentStatus.CANCELLED) {
        throw new BadRequestException('Compra cancelada. Ação não permitida.')
      }

      const installments = Array.isArray(purchase.installments) ? purchase.installments : []
      if ((purchase.installmentsCount ?? 0) > 0 && installments.length === 0) {
        throw new BadRequestException('Compra inválida: nenhuma parcela encontrada.')
      }

      const numbersToAffect = dto.payAll
        ? installments.map((i) => i.number)
        : Array.isArray(dto.numbers)
          ? dto.numbers
          : []

      if (!dto.payAll && numbersToAffect.length === 0) {
        throw new BadRequestException('Informe payAll=true ou numbers=[...].')
      }

      // valida números existentes
      const existingNumbers = new Set(installments.map((i) => i.number))
      for (const n of numbersToAffect) {
        if (!existingNumbers.has(n)) {
          throw new BadRequestException(`Parcela ${n} não existe nesta compra.`)
        }
      }

      const now = new Date()
      const paidAtValue = dto.paidAt ? this.parseDateOnlyToUTC(dto.paidAt) : now

      // snapshot para auditoria (antes)
      const before = purchase

      if (dto.action === SettleInstallmentsAction.SET_PAID) {
        const toUpdate = installments.filter(
          (i) => numbersToAffect.includes(i.number) && !i.paidAt,
        )

        await Promise.all(
          toUpdate.map((inst) =>
            tx.ownerFairPurchaseInstallment.update({
              where: {
                purchaseId_number: { purchaseId, number: inst.number },
              },
              data: {
                paidAt: paidAtValue,
                paidAmountCents: dto.paidAmountCents ?? undefined,
              },
            }),
          ),
        )
      } else if (dto.action === SettleInstallmentsAction.SET_UNPAID) {
        const toUpdate = installments.filter(
          (i) => numbersToAffect.includes(i.number) && !!i.paidAt,
        )

        await Promise.all(
          toUpdate.map((inst) =>
            tx.ownerFairPurchaseInstallment.update({
              where: {
                purchaseId_number: { purchaseId, number: inst.number },
              },
              data: { paidAt: null, paidAmountCents: null },
            }),
          ),
        )
      } else {
        throw new BadRequestException('Ação inválida. Use SET_PAID ou SET_UNPAID.')
      }

      // ✅ recarrega parcelas e recalcula financeiros da compra
      const refreshed = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: { installments: { orderBy: { number: 'asc' } } },
      })
      if (!refreshed) throw new NotFoundException('Compra não encontrada após atualização.')

      const computed = this.computePurchaseFinancials({
        totalCents: refreshed.totalCents,
        installments: (refreshed.installments ?? []).map((i) => ({
          dueDate: i.dueDate,
          amountCents: i.amountCents,
          paidAt: i.paidAt,
          paidAmountCents: i.paidAmountCents,
        })),
        now,
      })

      const updatedPurchase = await tx.ownerFairPurchase.update({
        where: { id: purchaseId },
        data: {
          paidCents: computed.paidCents,
          status: computed.status,
          paidAt: computed.paidAt,
        },
        include: { installments: { orderBy: { number: 'asc' } } },
      })

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.OWNER_FAIR_PURCHASE_PAYMENT,
        entityId: updatedPurchase.id,
        actorUserId,
        before,
        after: updatedPurchase,
        meta: {
          fairId,
          ownerId,
          ownerFairId: purchase.ownerFairId,
          purchaseId,
          action: dto.action,
          payAll: !!dto.payAll,
          numbers: numbersToAffect,
        },
      })

      return {
        ok: true,
        purchaseId: updatedPurchase.id,
        status: updatedPurchase.status,
        installmentsCount: updatedPurchase.installmentsCount,
        paidCount: updatedPurchase.installments.filter((i) => !!i.paidAt).length,
        paidCents: updatedPurchase.paidCents,
        totalCents: updatedPurchase.totalCents,
      }
    })
  }

  // ---------------------------------------------------------
  // Status do expositor
  // ---------------------------------------------------------

  /**
   * Atualiza o status operacional do expositor dentro da feira.
   * Observação:
   * - Esse status NÃO é o “status calculado” (CONCLUIDO).
   * - O CONCLUIDO é calculado via computeEffectiveStatus para evitar inconsistência.
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

  // ---------------------------------------------------------
  // Reprogramar vencimento (histórico)
  // ---------------------------------------------------------

  /**
   * Reprograma o vencimento de uma parcela (negociação).
   * Responsabilidade:
   * - Atualizar dueDate
   * - Recalcular status da compra (OVERDUE pode mudar)
   * - Gerar auditoria
   */
  async reschedulePurchaseInstallment(
    fairId: string,
    ownerId: string,
    purchaseId: string,
    installmentNumber: number,
    dto: { dueDate: string; reason?: string },
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: {
          ownerFair: { select: { id: true, ownerId: true, fairId: true } },
          installments: {
            orderBy: { number: 'asc' },
            include: { payments: { orderBy: { paidAt: 'asc' } } },
          },
        },
      })

      if (!purchase) throw new NotFoundException('Compra não encontrada.')
      if (purchase.ownerFair.fairId !== fairId)
        throw new BadRequestException('Compra não pertence à feira informada.')
      if (purchase.ownerFair.ownerId !== ownerId)
        throw new BadRequestException('Compra não pertence ao expositor informado.')

      const installment = (purchase.installments ?? []).find(
        (i) => i.number === installmentNumber,
      )
      if (!installment) throw new NotFoundException('Parcela não encontrada.')

      const before = installment

      const updatedInstallment = await tx.ownerFairPurchaseInstallment.update({
        where: { purchaseId_number: { purchaseId, number: installmentNumber } },
        data: { dueDate: this.parseDateOnlyToUTC(dto.dueDate) },
        include: { payments: { orderBy: { paidAt: 'asc' } } },
      })

      // ✅ Recalcula compra (status pode sair de OVERDUE)
      const now = new Date()
      const purchaseAfterReload = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: {
          installments: { orderBy: { number: 'asc' } },
        },
      })
      if (!purchaseAfterReload)
        throw new NotFoundException('Compra não encontrada após reagendamento.')

      const purchaseComputed = this.computePurchaseCacheFromInstallments({
        totalCents: purchaseAfterReload.totalCents,
        installments: purchaseAfterReload.installments.map((i) => ({
          dueDate: i.dueDate,
          amountCents: i.amountCents,
          paidAmountCents: i.paidAmountCents,
          paidAt: i.paidAt,
        })),
        now,
      })

      const purchaseUpdated = await tx.ownerFairPurchase.update({
        where: { id: purchaseId },
        data: {
          paidCents: purchaseComputed.paidCents,
          status: purchaseComputed.status,
          paidAt: purchaseComputed.paidAt,
        },
      })

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.OWNER_FAIR_PURCHASE_PAYMENT,
        entityId: purchaseId,
        actorUserId,
        before: { installment: before },
        after: { installment: updatedInstallment, purchase: purchaseUpdated },
        meta: {
          fairId,
          ownerId,
          ownerFairId: purchase.ownerFairId,
          purchaseId,
          installmentNumber,
          action: 'RESCHEDULE_DUE_DATE',
          reason: dto.reason ?? null,
          newDueDate: dto.dueDate,
        },
      })

      return {
        ok: true,
        purchaseId: purchaseUpdated.id,
        purchaseStatus: purchaseUpdated.status,
        purchaseTotalCents: purchaseUpdated.totalCents,
        purchasePaidCents: purchaseUpdated.paidCents,
        purchasePaidAt: purchaseUpdated.paidAt ? purchaseUpdated.paidAt.toISOString() : null,
        installmentId: updatedInstallment.id,
        installmentNumber: updatedInstallment.number,
        installmentAmountCents: updatedInstallment.amountCents,
        installmentPaidAmountCents: updatedInstallment.paidAmountCents ?? 0,
        installmentPaidAt: updatedInstallment.paidAt ? updatedInstallment.paidAt.toISOString() : null,
        installmentDueDate: updatedInstallment.dueDate.toISOString(),
      }
    })
  }

  // ---------------------------------------------------------
  // Registrar pagamento parcial (histórico)
  // ---------------------------------------------------------

  /**
   * Registra um pagamento no histórico de uma parcela.
   * Responsabilidade:
   * - Criar registro em OwnerFairPurchaseInstallmentPayment
   * - Recalcular cache da parcela (paidAmountCents, paidAt quando quitou)
   * - Recalcular cache/status da compra (paidCents, status, paidAt)
   * - Gerar auditoria
   */
  async createInstallmentPayment(
    fairId: string,
    ownerId: string,
    purchaseId: string,
    installmentNumber: number,
    dto: { paidAt: string; amountCents: number; note?: string },
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: {
          ownerFair: { select: { id: true, ownerId: true, fairId: true } },
          installments: {
            orderBy: { number: 'asc' },
            include: { payments: { orderBy: { paidAt: 'asc' } } },
          },
        },
      })

      if (!purchase) throw new NotFoundException('Compra não encontrada.')
      if (purchase.ownerFair.fairId !== fairId)
        throw new BadRequestException('Compra não pertence à feira informada.')
      if (purchase.ownerFair.ownerId !== ownerId)
        throw new BadRequestException('Compra não pertence ao expositor informado.')

      if (purchase.status === OwnerFairPaymentStatus.CANCELLED) {
        throw new BadRequestException('Compra cancelada. Ação não permitida.')
      }

      const installment = (purchase.installments ?? []).find(
        (i) => i.number === installmentNumber,
      )
      if (!installment) throw new NotFoundException('Parcela não encontrada.')

      // ✅ cria pagamento no histórico
      const payment = await tx.ownerFairPurchaseInstallmentPayment.create({
        data: {
          installmentId: installment.id,
          paidAt: this.parseDateOnlyToUTC(dto.paidAt),
          amountCents: dto.amountCents,
          note: dto.note ?? null,
          createdByUserId: actorUserId,
        },
      })

      // ✅ recarrega pagamentos da parcela para recalcular cache
      const installmentAfter = await tx.ownerFairPurchaseInstallment.findUnique({
        where: { id: installment.id },
        include: { payments: { orderBy: { paidAt: 'asc' } } },
      })
      if (!installmentAfter)
        throw new NotFoundException('Parcela não encontrada após pagamento.')

      const installmentCache = this.computeInstallmentCache({
        installmentAmountCents: installmentAfter.amountCents,
        payments: installmentAfter.payments.map((p) => ({
          paidAt: p.paidAt,
          amountCents: p.amountCents,
        })),
      })

      const installmentUpdated = await tx.ownerFairPurchaseInstallment.update({
        where: { id: installment.id },
        data: {
          paidAmountCents: installmentCache.paidAmountCents,
          paidAt: installmentCache.paidAt,
        },
      })

      // ✅ recalcula compra (paidCents/status/paidAt)
      const purchaseReload = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: { installments: { orderBy: { number: 'asc' } } },
      })
      if (!purchaseReload)
        throw new NotFoundException('Compra não encontrada após pagamento.')

      const now = new Date()
      const purchaseComputed = this.computePurchaseCacheFromInstallments({
        totalCents: purchaseReload.totalCents,
        installments: purchaseReload.installments.map((i) => ({
          dueDate: i.dueDate,
          amountCents: i.amountCents,
          paidAmountCents: i.paidAmountCents,
          paidAt: i.paidAt,
        })),
        now,
      })

      const purchaseUpdated = await tx.ownerFairPurchase.update({
        where: { id: purchaseId },
        data: {
          paidCents: purchaseComputed.paidCents,
          status: purchaseComputed.status,
          paidAt: purchaseComputed.paidAt,
        },
      })

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.OWNER_FAIR_PURCHASE_PAYMENT,
        entityId: purchaseId,
        actorUserId,
        before: null,
        after: { payment, installment: installmentUpdated, purchase: purchaseUpdated },
        meta: {
          fairId,
          ownerId,
          ownerFairId: purchase.ownerFairId,
          purchaseId,
          installmentNumber,
          action: 'CREATE_INSTALLMENT_PAYMENT',
          paidAt: dto.paidAt,
          amountCents: dto.amountCents,
          note: dto.note ?? null,
        },
      })

      return {
        ok: true,
        purchaseId: purchaseUpdated.id,
        purchaseStatus: purchaseUpdated.status,
        purchaseTotalCents: purchaseUpdated.totalCents,
        purchasePaidCents: purchaseUpdated.paidCents,
        purchasePaidAt: purchaseUpdated.paidAt ? purchaseUpdated.paidAt.toISOString() : null,
        installmentId: installmentUpdated.id,
        installmentNumber: installmentUpdated.number,
        installmentAmountCents: installmentUpdated.amountCents,
        installmentPaidAmountCents: installmentUpdated.paidAmountCents ?? 0,
        installmentPaidAt: installmentUpdated.paidAt ? installmentUpdated.paidAt.toISOString() : null,
        installmentDueDate: installmentUpdated.dueDate.toISOString(),
      }
    })
  }
}
