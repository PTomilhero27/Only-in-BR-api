import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from 'src/prisma/prisma.service'
import { ListMyFairsResponseDto } from './dto/list-my-fairs.response.dto'
import { ExhibitorFairListItemDto } from './dto/exhibitor-fair-list-item.dto'
import { LinkStallResponseDto } from './dto/link-stall.response.dto'
import { UnlinkStallResponseDto } from './dto/unlink-stall.response.dto'
import { ExhibitorFairPaymentSummaryDto } from './dto/exhibitor-fair-payment-summary.dto'
import { FairStatus, OwnerFairPaymentStatus, OwnerFairStatus, Prisma, StallSize } from '@prisma/client'

/**
 * Service de Feiras do Expositor (Portal autenticado).
 *
 * Responsabilidade:
 * - Transformar (userId do JWT) em ownerId (fonte de verdade)
 * - Listar feiras do expositor com:
 *   - status na feira (OwnerFair.status)
 *   - compra total (OwnerFair.stallsQty)
 *   - compra por tamanho (OwnerFairStallSlot)
 *   - barracas já vinculadas (StallFair)
 *   - ✅ resumo de pagamento (OwnerFairPaymentPlan + Installments)
 * - Vincular e desvincular barracas em feiras com validações
 *
 * Decisão importante (Prisma):
 * - Para relations, NÃO misturar `include` e `select` no mesmo nível.
 *   Aqui usamos apenas `select` em paymentPlan para evitar erro.
 */
@Injectable()
export class ExhibitorFairsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve e valida o ownerId a partir do userId do token.
   * Mantém autorização centralizada no backend (evita bugs no front).
   */
  private async getOwnerIdOrThrow(userId: string): Promise<string> {
    if (!userId) throw new BadRequestException('userId ausente no token.')

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, ownerId: true, isActive: true },
    })

    if (!user || !user.isActive) {
      throw new NotFoundException('Usuário não encontrado ou inativo.')
    }

    if (!user.ownerId) {
      throw new BadRequestException('Este usuário não está vinculado a um expositor (ownerId).')
    }

    return user.ownerId
  }

  /**
   * Monta um resumo de pagamento "pronto para UI".
   * Se não houver plano, retorna null.
   */
  private buildPaymentSummaryOrNull(plan: {
    status: OwnerFairPaymentStatus
    totalCents: number
    installmentsCount: number
    installments: Array<{
      number: number
      dueDate: Date
      amountCents: number
      paidAt: Date | null
      paidAmountCents: number | null
    }>
  } | null): ExhibitorFairPaymentSummaryDto | null {
    if (!plan) return null

    const installments = (plan.installments ?? [])
      .slice()
      .sort((a, b) => a.number - b.number)

    const paidCount = installments.filter((i) => !!i.paidAt).length
    const nextOpen = installments.find((i) => !i.paidAt)
    const nextDueDate = nextOpen ? nextOpen.dueDate.toISOString() : null

    return {
      status: plan.status,
      totalCents: plan.totalCents,
      installmentsCount: plan.installmentsCount,
      paidCount,
      nextDueDate,
      installments: installments.map((i) => ({
        number: i.number,
        dueDate: i.dueDate.toISOString(),
        amountCents: i.amountCents,
        paidAt: i.paidAt ? i.paidAt.toISOString() : null,
        paidAmountCents: i.paidAmountCents ?? null,
      })),
    }
  }

  /**
   * Lista feiras do expositor logado.
   * Retorna dados prontos para renderizar cards/accordion na tela "Feiras".
   */
  async listMyFairsByMe(userId: string): Promise<ListMyFairsResponseDto> {
    const ownerId = await this.getOwnerIdOrThrow(userId)

    const ownerFairs = await this.prisma.ownerFair.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        stallSlots: { orderBy: { stallSize: 'asc' } },

        /**
         * ✅ FIX PRISMA:
         * Não misturar `include` e `select` no mesmo nível.
         * Aqui usamos apenas `select` e dentro dele selecionamos installments com orderBy.
         */
        paymentPlan: {
          select: {
            status: true,
            totalCents: true,
            installmentsCount: true,
            installments: {
              orderBy: { number: 'asc' },
              select: {
                number: true,
                dueDate: true,
                amountCents: true,
                paidAt: true,
                paidAmountCents: true,
              },
            },
          },
        },

        fair: {
          select: {
            id: true,
            name: true,
            status: true,
            stallFairs: {
              where: { stall: { ownerId } },
              include: {
                stall: { select: { id: true, pdvName: true, stallSize: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    })

    const items: ExhibitorFairListItemDto[] = ownerFairs.map((of) => {
      const linked = of.fair.stallFairs ?? []

      const payment = this.buildPaymentSummaryOrNull(
        of.paymentPlan
          ? {
              status: of.paymentPlan.status as OwnerFairPaymentStatus,
              totalCents: of.paymentPlan.totalCents,
              installmentsCount: of.paymentPlan.installmentsCount,
              installments: (of.paymentPlan.installments ?? []).map((i) => ({
                number: i.number,
                dueDate: i.dueDate,
                amountCents: i.amountCents,
                paidAt: i.paidAt ?? null,
                paidAmountCents: i.paidAmountCents ?? null,
              })),
            }
          : null,
      )

      return {
        fairId: of.fair.id,
        fairName: of.fair.name,
        fairStatus: of.fair.status as FairStatus,

        ownerFairStatus: of.status as OwnerFairStatus,

        stallsQtyPurchased: of.stallsQty,

        stallSlots: (of.stallSlots ?? []).map((s) => ({
          stallSize: s.stallSize as StallSize,
          qty: s.qty,
          unitPriceCents: s.unitPriceCents,
        })),

        stallsLinkedQty: linked.length,

        linkedStalls: linked.map((sf) => ({
          stallId: sf.stall.id,
          pdvName: sf.stall.pdvName,
          stallSize: sf.stall.stallSize as StallSize,
          linkedAt: sf.createdAt.toISOString(),
        })),

        payment,
      }
    })

    return { items }
  }

  /**
   * Vincula uma barraca do expositor a uma feira.
   *
   * Validações:
   * 1) Owner deve estar vinculado à feira (OwnerFair)
   * 2) Barraca deve pertencer ao Owner
   * 3) Não pode exceder total comprado (OwnerFair.stallsQty)
   * 4) Não pode exceder total comprado por tamanho (OwnerFairStallSlot.qty)
   * 5) Não pode duplicar vínculo (StallFair unique)
   */
  async linkStallToFairByMe(
    userId: string,
    fairId: string,
    stallId: string,
  ): Promise<LinkStallResponseDto> {
    const ownerId = await this.getOwnerIdOrThrow(userId)

    const ownerFair = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId } },
      include: { stallSlots: true },
    })
    if (!ownerFair) {
      throw new BadRequestException('Você não está vinculado a esta feira.')
    }

    const stall = await this.prisma.stall.findFirst({
      where: { id: stallId, ownerId },
      select: { id: true, stallSize: true },
    })
    if (!stall) throw new NotFoundException('Barraca não encontrada.')

    const linkedTotalQty = await this.prisma.stallFair.count({
      where: { fairId, stall: { ownerId } },
    })

    if (linkedTotalQty >= ownerFair.stallsQty) {
      throw new BadRequestException('Você já vinculou todas as barracas compradas nesta feira.')
    }

    const purchasedSlot = (ownerFair.stallSlots ?? []).find((s) => s.stallSize === stall.stallSize)
    if (!purchasedSlot) {
      throw new BadRequestException('O tamanho desta barraca não foi adquirido nesta feira.')
    }

    const linkedSameSizeQty = await this.prisma.stallFair.count({
      where: {
        fairId,
        stall: { ownerId, stallSize: stall.stallSize },
      },
    })

    if (linkedSameSizeQty >= purchasedSlot.qty) {
      throw new BadRequestException('Você já vinculou todas as barracas deste tamanho.')
    }

    try {
      await this.prisma.stallFair.create({
        data: { fairId, stallId },
        select: { id: true },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Esta barraca já está vinculada nesta feira.')
      }
      throw err
    }

    return { ok: true }
  }

  /**
   * Desvincula uma barraca do expositor de uma feira.
   */
  async unlinkStallFromFairByMe(
    userId: string,
    fairId: string,
    stallId: string,
  ): Promise<UnlinkStallResponseDto> {
    const ownerId = await this.getOwnerIdOrThrow(userId)

    const ownerFair = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId } },
      select: { id: true },
    })
    if (!ownerFair) {
      throw new BadRequestException('Você não está vinculado a esta feira.')
    }

    const stall = await this.prisma.stall.findFirst({
      where: { id: stallId, ownerId },
      select: { id: true },
    })
    if (!stall) throw new NotFoundException('Barraca não encontrada.')

    const found = await this.prisma.stallFair.findUnique({
      where: { stallId_fairId: { stallId, fairId } },
      select: { id: true },
    })
    if (!found) {
      throw new NotFoundException('Vínculo desta barraca com a feira não encontrado.')
    }

    await this.prisma.stallFair.delete({ where: { id: found.id } })

    return { ok: true }
  }
}
