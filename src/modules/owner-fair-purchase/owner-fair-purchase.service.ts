/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdjustmentType,
  AuditAction,
  AuditEntity,
  FairStatus,
  OwnerFairPaymentStatus,
  OwnerFairStatus,
} from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/common/audit/audit.service';

import {
  SettleInstallmentsAction,
  SettleStallInstallmentsDto,
} from './dto/settle-stall-installments.dto';
import { CreatePurchaseAdjustmentDto } from './dto/create-purchase-adjustment.dto';

@Injectable()
export class OwnerFairPurchasesService {
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
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /**
   * Normaliza uma data "pura" (YYYY-MM-DD) para Date em UTC (00:00Z),
   * evitando bugs de timezone na UI e mantendo consistência no banco.
   */
  private parseDateOnlyToUTC(dateOnly: string) {
    return new Date(`${dateOnly}T00:00:00.000Z`);
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
    installmentAmountCents: number;
    payments: Array<{ paidAt: Date; amountCents: number }>;
  }): { paidAmountCents: number; paidAt: Date | null } {
    const amount = Number(input.installmentAmountCents ?? 0);
    const sum = (input.payments ?? []).reduce(
      (acc, p) => acc + Number(p.amountCents ?? 0),
      0,
    );

    if (amount <= 0) return { paidAmountCents: 0, paidAt: null };

    if (sum >= amount) {
      const maxPaidAt =
        input.payments
          .map((p) => p.paidAt)
          .sort((a, b) => a.getTime() - b.getTime())
          .at(-1) ?? null;

      return { paidAmountCents: sum, paidAt: maxPaidAt };
    }

    return { paidAmountCents: sum, paidAt: null };
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
    totalCents: number;
    installments: Array<{
      dueDate: Date;
      amountCents: number;
      paidAmountCents: number | null;
      paidAt: Date | null;
    }>;
    now: Date;
  }): {
    paidCents: number;
    status: OwnerFairPaymentStatus;
    paidAt: Date | null;
  } {
    const total = Number(input.totalCents ?? 0);
    const installments = Array.isArray(input.installments)
      ? input.installments
      : [];

    const installmentsTotal = installments.reduce(
      (acc, i) => acc + Number(i.amountCents ?? 0),
      0,
    );
    const entryCents = Math.max(0, total - installmentsTotal);

    const paidInstallments = installments.reduce((acc, i) => {
      const v = Number(i.paidAmountCents ?? 0);
      return acc + v;
    }, 0);

    const paidCents = Math.min(total, entryCents + paidInstallments);

    const today0 = this.day0(input.now);
    const hasOverdue = installments.some((i) => {
      if (i.paidAt) return false;
      const due0 = this.day0(new Date(i.dueDate));
      return due0.getTime() < today0.getTime();
    });

    let status: OwnerFairPaymentStatus;
    if (total > 0 && paidCents >= total) status = OwnerFairPaymentStatus.PAID;
    else if (hasOverdue) status = OwnerFairPaymentStatus.OVERDUE;
    else if (paidCents > 0) status = OwnerFairPaymentStatus.PARTIALLY_PAID;
    else status = OwnerFairPaymentStatus.PENDING;

    return {
      paidCents,
      status,
      paidAt: status === OwnerFairPaymentStatus.PAID ? input.now : null,
    };
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
   */
  private computePurchaseFinancials(input: {
    totalCents: number;
    installments: Array<{
      dueDate: Date;
      amountCents: number;
      paidAt: Date | null;
      paidAmountCents: number | null;
    }>;
    now: Date;
  }): {
    paidCents: number;
    status: OwnerFairPaymentStatus;
    paidAt: Date | null;
  } {
    const totalCents = Number(input.totalCents ?? 0);
    const installments = Array.isArray(input.installments)
      ? input.installments
      : [];

    const installmentsTotal = installments.reduce(
      (acc, i) => acc + Number(i.amountCents ?? 0),
      0,
    );

    const entryCents = Math.max(0, totalCents - installmentsTotal);

    const paidInstallmentsCents = installments.reduce((acc, i) => {
      if (!i.paidAt) return acc;
      const v = i.paidAmountCents ?? i.amountCents;
      return acc + Number(v ?? 0);
    }, 0);

    const paidCents = Math.min(totalCents, entryCents + paidInstallmentsCents);

    const today0 = this.day0(input.now);

    const anyOverdue = installments.some((i) => {
      if (i.paidAt) return false;
      const due0 = this.day0(new Date(i.dueDate));
      return due0.getTime() < today0.getTime();
    });

    let status: OwnerFairPaymentStatus;
    if (paidCents >= totalCents && totalCents > 0)
      status = OwnerFairPaymentStatus.PAID;
    else if (anyOverdue) status = OwnerFairPaymentStatus.OVERDUE;
    else if (paidCents > 0) status = OwnerFairPaymentStatus.PARTIALLY_PAID;
    else status = OwnerFairPaymentStatus.PENDING;

    const paidAt = status === OwnerFairPaymentStatus.PAID ? input.now : null;

    return { paidCents, status, paidAt };
  }

  /**
   * Recalcula e, se necessário, atualiza o status do OwnerFair com base no estado real.
   * Regra (primeiro gargalo):
   * - Se não está 100% pago => AGUARDANDO_PAGAMENTO
   * - Senão se não assinou => AGUARDANDO_ASSINATURA
   * - Senão se barracas incompletas (ou sem compras) => AGUARDANDO_BARRACAS
   * - Senão => CONCLUIDO
   */
  private async recomputeAndApplyOwnerFairStatus(
    tx: any,
    ownerFairId: string,
    actorUserId: string,
    meta?: Record<string, any>,
  ) {
    const ownerFair = await tx.ownerFair.findUnique({
      where: { id: ownerFairId },
      include: {
        stallFairs: true,
        contract: true,
        ownerFairPurchases: {
          include: { installments: true },
        },
      },
    });

    if (!ownerFair) {
      throw new NotFoundException(
        'OwnerFair não encontrado para recomputar status.',
      );
    }

    const purchases = Array.isArray(ownerFair.ownerFairPurchases)
      ? ownerFair.ownerFairPurchases
      : [];

    const purchasedQty = purchases.reduce((acc, p) => acc + (p.qty ?? 0), 0);
    const linkedQty = ownerFair.stallFairs?.length ?? 0;

    const totalCents = purchases.reduce(
      (acc, p) => acc + (p.totalCents ?? 0),
      0,
    );
    const paidCents = purchases.reduce((acc, p) => acc + (p.paidCents ?? 0), 0);
    const remainingCents = Math.max(0, totalCents - paidCents);

    const isFullyPaid = remainingCents === 0;
    const isSigned = Boolean(
      ownerFair.contractSignedAt || ownerFair.contract?.signedAt,
    );

    const hasPurchases = purchasedQty > 0;
    const stallsAreComplete = hasPurchases && linkedQty >= purchasedQty;

    const missing: string[] = [];

    let effectiveStatus: OwnerFairStatus;

    if (!isFullyPaid) {
      effectiveStatus = OwnerFairStatus.AGUARDANDO_PAGAMENTO;
      missing.push(
        `Pagamento pendente: faltam ${remainingCents} centavos (total=${totalCents}, pago=${paidCents}).`,
      );
    } else if (!isSigned) {
      effectiveStatus = OwnerFairStatus.AGUARDANDO_ASSINATURA;
      missing.push('Contrato ainda não foi assinado.');
    } else if (!hasPurchases) {
      effectiveStatus = OwnerFairStatus.AGUARDANDO_BARRACAS;
      missing.push('Nenhuma compra de barraca registrada para este expositor.');
    } else if (!stallsAreComplete) {
      effectiveStatus = OwnerFairStatus.AGUARDANDO_BARRACAS;
      missing.push(
        `Barracas pendentes: vinculadas=${linkedQty}, compradas=${purchasedQty}.`,
      );
    } else {
      effectiveStatus = OwnerFairStatus.CONCLUIDO;
    }

    if (ownerFair.status === effectiveStatus) {
      return {
        updated: false,
        ownerFairId: ownerFair.id,
        status: ownerFair.status,
        effectiveStatus,
        missing,
      };
    }

    const before = ownerFair;

    const after = await tx.ownerFair.update({
      where: { id: ownerFair.id },
      data: { status: effectiveStatus },
    });

    await this.audit.log(tx, {
      action: AuditAction.UPDATE,
      entity: AuditEntity.OWNER_FAIR,
      entityId: after.id,
      actorUserId,
      before,
      after,
      meta: {
        reason: 'RECOMPUTE_AFTER_PAYMENT_CHANGE',
        missing,
        purchasedQty,
        linkedQty,
        totalCents,
        paidCents,
        remainingCents,
        isSigned,
        ...meta,
      },
    });

    return {
      updated: true,
      ownerFairId: after.id,
      status: after.status,
      effectiveStatus,
      missing,
    };
  }

  /**
   * Decide quando recomputar status do OwnerFair após update financeiro.
   * Regra atual:
   * - Só recomputa quando total > 0 e ficou 100% pago.
   */
  private shouldRecomputeOwnerFairAfterPurchaseUpdate(args: {
    totalCents: number;
    paidCents: number;
  }) {
    if ((args.totalCents ?? 0) <= 0) return false;
    return (args.paidCents ?? 0) >= (args.totalCents ?? 0);
  }

  // ---------------------------------------------------------
  // PATCH installments (por PURCHASE)
  // ---------------------------------------------------------

  async settleStallInstallments(
    fairId: string,
    ownerId: string,
    dto: SettleStallInstallmentsDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseId = dto.purchaseId;

      const purchase = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: {
          ownerFair: { select: { id: true, ownerId: true, fairId: true, fair: { select: { status: true } } } },
          installments: { orderBy: { number: 'asc' } },
        },
      });

      if (!purchase)
        throw new NotFoundException(
          'Compra (OwnerFairPurchase) não encontrada.',
        );

      if (purchase.ownerFair.fair.status === FairStatus.FINALIZADA) {
        throw new BadRequestException('Ação não permitida em feira finalizada.');
      }

      if (purchase.ownerFair.fairId !== fairId) {
        throw new BadRequestException('Compra não pertence à feira informada.');
      }
      if (purchase.ownerFair.ownerId !== ownerId) {
        throw new BadRequestException(
          'Compra não pertence ao expositor informado.',
        );
      }

      if (purchase.status === OwnerFairPaymentStatus.CANCELLED) {
        throw new BadRequestException('Compra cancelada. Ação não permitida.');
      }

      const installments = Array.isArray(purchase.installments)
        ? purchase.installments
        : [];
      if ((purchase.installmentsCount ?? 0) > 0 && installments.length === 0) {
        throw new BadRequestException(
          'Compra inválida: nenhuma parcela encontrada.',
        );
      }

      const numbersToAffect = dto.payAll
        ? installments.map((i) => i.number)
        : Array.isArray(dto.numbers)
          ? dto.numbers
          : [];

      if (!dto.payAll && numbersToAffect.length === 0) {
        throw new BadRequestException('Informe payAll=true ou numbers=[...].');
      }

      const existingNumbers = new Set(installments.map((i) => i.number));
      for (const n of numbersToAffect) {
        if (!existingNumbers.has(n)) {
          throw new BadRequestException(
            `Parcela ${n} não existe nesta compra.`,
          );
        }
      }

      const now = new Date();
      const paidAtValue = dto.paidAt
        ? this.parseDateOnlyToUTC(dto.paidAt)
        : now;

      const before = purchase;

      if (dto.action === SettleInstallmentsAction.SET_PAID) {
        const toUpdate = installments.filter(
          (i) => numbersToAffect.includes(i.number) && !i.paidAt,
        );

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
        );
      } else if (dto.action === SettleInstallmentsAction.SET_UNPAID) {
        const toUpdate = installments.filter(
          (i) => numbersToAffect.includes(i.number) && !!i.paidAt,
        );

        await Promise.all(
          toUpdate.map((inst) =>
            tx.ownerFairPurchaseInstallment.update({
              where: {
                purchaseId_number: { purchaseId, number: inst.number },
              },
              data: { paidAt: null, paidAmountCents: null },
            }),
          ),
        );
      } else {
        throw new BadRequestException(
          'Ação inválida. Use SET_PAID ou SET_UNPAID.',
        );
      }

      const refreshed = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: { installments: { orderBy: { number: 'asc' } } },
      });
      if (!refreshed)
        throw new NotFoundException('Compra não encontrada após atualização.');

      const computed = this.computePurchaseFinancials({
        totalCents: refreshed.totalCents,
        installments: (refreshed.installments ?? []).map((i) => ({
          dueDate: i.dueDate,
          amountCents: i.amountCents,
          paidAt: i.paidAt,
          paidAmountCents: i.paidAmountCents,
        })),
        now,
      });

      const updatedPurchase = await tx.ownerFairPurchase.update({
        where: { id: purchaseId },
        data: {
          paidCents: computed.paidCents,
          status: computed.status,
          paidAt: computed.paidAt,
        },
        include: { installments: { orderBy: { number: 'asc' } } },
      });

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
      });

      let ownerFairStatusInfo: any = null;
      if (
        this.shouldRecomputeOwnerFairAfterPurchaseUpdate({
          totalCents: updatedPurchase.totalCents,
          paidCents: updatedPurchase.paidCents,
        })
      ) {
        ownerFairStatusInfo = await this.recomputeAndApplyOwnerFairStatus(
          tx,
          purchase.ownerFairId,
          actorUserId,
          { trigger: 'SETTLE_INSTALLMENTS', purchaseId },
        );
      }

      return {
        ok: true,
        purchaseId: updatedPurchase.id,
        status: updatedPurchase.status,
        installmentsCount: updatedPurchase.installmentsCount,
        paidCount: updatedPurchase.installments.filter((i) => !!i.paidAt)
          .length,
        paidCents: updatedPurchase.paidCents,
        totalCents: updatedPurchase.totalCents,
        ownerFairStatus: ownerFairStatusInfo?.status ?? null,
        ownerFairStatusInfo,
      };
    });
  }

  // ---------------------------------------------------------
  // Reprogramar vencimento (histórico)
  // ---------------------------------------------------------

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
          ownerFair: { select: { id: true, ownerId: true, fairId: true, fair: { select: { status: true } } } },
          installments: {
            orderBy: { number: 'asc' },
            include: { payments: { orderBy: { paidAt: 'asc' } } },
          },
        },
      });

      if (!purchase) throw new NotFoundException('Compra não encontrada.');
      if (purchase.ownerFair.fair.status === FairStatus.FINALIZADA) {
        throw new BadRequestException('Ação não permitida em feira finalizada.');
      }
      if (purchase.ownerFair.fairId !== fairId)
        throw new BadRequestException('Compra não pertence à feira informada.');
      if (purchase.ownerFair.ownerId !== ownerId)
        throw new BadRequestException(
          'Compra não pertence ao expositor informado.',
        );

      const installment = (purchase.installments ?? []).find(
        (i) => i.number === installmentNumber,
      );
      if (!installment) throw new NotFoundException('Parcela não encontrada.');

      const before = installment;

      const updatedInstallment = await tx.ownerFairPurchaseInstallment.update({
        where: { purchaseId_number: { purchaseId, number: installmentNumber } },
        data: { dueDate: this.parseDateOnlyToUTC(dto.dueDate) },
        include: { payments: { orderBy: { paidAt: 'asc' } } },
      });

      const now = new Date();
      const purchaseAfterReload = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: {
          installments: { orderBy: { number: 'asc' } },
        },
      });
      if (!purchaseAfterReload)
        throw new NotFoundException(
          'Compra não encontrada após reagendamento.',
        );

      const purchaseComputed = this.computePurchaseCacheFromInstallments({
        totalCents: purchaseAfterReload.totalCents,
        installments: purchaseAfterReload.installments.map((i) => ({
          dueDate: i.dueDate,
          amountCents: i.amountCents,
          paidAmountCents: i.paidAmountCents,
          paidAt: i.paidAt,
        })),
        now,
      });

      const purchaseUpdated = await tx.ownerFairPurchase.update({
        where: { id: purchaseId },
        data: {
          paidCents: purchaseComputed.paidCents,
          status: purchaseComputed.status,
          paidAt: purchaseComputed.paidAt,
        },
      });

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
      });

      let ownerFairStatusInfo: any = null;
      if (
        this.shouldRecomputeOwnerFairAfterPurchaseUpdate({
          totalCents: purchaseUpdated.totalCents,
          paidCents: purchaseUpdated.paidCents,
        })
      ) {
        ownerFairStatusInfo = await this.recomputeAndApplyOwnerFairStatus(
          tx,
          purchase.ownerFairId,
          actorUserId,
          { trigger: 'RESCHEDULE_INSTALLMENT', purchaseId, installmentNumber },
        );
      }

      return {
        ok: true,
        purchaseId: purchaseUpdated.id,
        purchaseStatus: purchaseUpdated.status,
        purchaseTotalCents: purchaseUpdated.totalCents,
        purchasePaidCents: purchaseUpdated.paidCents,
        purchasePaidAt: purchaseUpdated.paidAt
          ? purchaseUpdated.paidAt.toISOString()
          : null,
        installmentId: updatedInstallment.id,
        installmentNumber: updatedInstallment.number,
        installmentAmountCents: updatedInstallment.amountCents,
        installmentPaidAmountCents: updatedInstallment.paidAmountCents ?? 0,
        installmentPaidAt: updatedInstallment.paidAt
          ? updatedInstallment.paidAt.toISOString()
          : null,
        installmentDueDate: updatedInstallment.dueDate.toISOString(),
        ownerFairStatus: ownerFairStatusInfo?.status ?? null,
        ownerFairStatusInfo,
      };
    });
  }

  // ---------------------------------------------------------
  // Registrar pagamento parcial (histórico)
  // ---------------------------------------------------------

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
          ownerFair: { select: { id: true, ownerId: true, fairId: true, fair: { select: { status: true } } } },
          installments: {
            orderBy: { number: 'asc' },
            include: { payments: { orderBy: { paidAt: 'asc' } } },
          },
        },
      });

      if (!purchase) throw new NotFoundException('Compra não encontrada.');
      if (purchase.ownerFair.fair.status === FairStatus.FINALIZADA) {
        throw new BadRequestException('Ação não permitida em feira finalizada.');
      }
      if (purchase.ownerFair.fairId !== fairId)
        throw new BadRequestException('Compra não pertence à feira informada.');
      if (purchase.ownerFair.ownerId !== ownerId)
        throw new BadRequestException(
          'Compra não pertence ao expositor informado.',
        );

      if (purchase.status === OwnerFairPaymentStatus.CANCELLED) {
        throw new BadRequestException('Compra cancelada. Ação não permitida.');
      }

      const installment = (purchase.installments ?? []).find(
        (i) => i.number === installmentNumber,
      );
      if (!installment) throw new NotFoundException('Parcela não encontrada.');

      const payment = await tx.ownerFairPurchaseInstallmentPayment.create({
        data: {
          installmentId: installment.id,
          paidAt: this.parseDateOnlyToUTC(dto.paidAt),
          amountCents: dto.amountCents,
          note: dto.note ?? null,
          createdByUserId: actorUserId,
        },
      });

      const installmentAfter = await tx.ownerFairPurchaseInstallment.findUnique(
        {
          where: { id: installment.id },
          include: { payments: { orderBy: { paidAt: 'asc' } } },
        },
      );
      if (!installmentAfter)
        throw new NotFoundException('Parcela não encontrada após pagamento.');

      const installmentCache = this.computeInstallmentCache({
        installmentAmountCents: installmentAfter.amountCents,
        payments: installmentAfter.payments.map((p) => ({
          paidAt: p.paidAt,
          amountCents: p.amountCents,
        })),
      });

      const installmentUpdated = await tx.ownerFairPurchaseInstallment.update({
        where: { id: installment.id },
        data: {
          paidAmountCents: installmentCache.paidAmountCents,
          paidAt: installmentCache.paidAt,
        },
      });

      const purchaseReload = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: { installments: { orderBy: { number: 'asc' } } },
      });
      if (!purchaseReload)
        throw new NotFoundException('Compra não encontrada após pagamento.');

      const now = new Date();
      const purchaseComputed = this.computePurchaseCacheFromInstallments({
        totalCents: purchaseReload.totalCents,
        installments: purchaseReload.installments.map((i) => ({
          dueDate: i.dueDate,
          amountCents: i.amountCents,
          paidAmountCents: i.paidAmountCents,
          paidAt: i.paidAt,
        })),
        now,
      });

      const purchaseUpdated = await tx.ownerFairPurchase.update({
        where: { id: purchaseId },
        data: {
          paidCents: purchaseComputed.paidCents,
          status: purchaseComputed.status,
          paidAt: purchaseComputed.paidAt,
        },
      });

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.OWNER_FAIR_PURCHASE_PAYMENT,
        entityId: purchaseId,
        actorUserId,
        before: null,
        after: {
          payment,
          installment: installmentUpdated,
          purchase: purchaseUpdated,
        },
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
      });

      let ownerFairStatusInfo: any = null;
      if (
        this.shouldRecomputeOwnerFairAfterPurchaseUpdate({
          totalCents: purchaseUpdated.totalCents,
          paidCents: purchaseUpdated.paidCents,
        })
      ) {
        ownerFairStatusInfo = await this.recomputeAndApplyOwnerFairStatus(
          tx,
          purchase.ownerFairId,
          actorUserId,
          {
            trigger: 'CREATE_INSTALLMENT_PAYMENT',
            purchaseId,
            installmentNumber,
          },
        );
      }

      return {
        ok: true,
        purchaseId: purchaseUpdated.id,
        purchaseStatus: purchaseUpdated.status,
        purchaseTotalCents: purchaseUpdated.totalCents,
        purchasePaidCents: purchaseUpdated.paidCents,
        purchasePaidAt: purchaseUpdated.paidAt
          ? purchaseUpdated.paidAt.toISOString()
          : null,
        installmentId: installmentUpdated.id,
        installmentNumber: installmentUpdated.number,
        installmentAmountCents: installmentUpdated.amountCents,
        installmentPaidAmountCents: installmentUpdated.paidAmountCents ?? 0,
        installmentPaidAt: installmentUpdated.paidAt
          ? installmentUpdated.paidAt.toISOString()
          : null,
        installmentDueDate: installmentUpdated.dueDate.toISOString(),
        ownerFairStatus: ownerFairStatusInfo?.status ?? null,
        ownerFairStatusInfo,
      };
    });
  }

  /**
   * Cria um ajuste financeiro (DESCONTO ou ACRÉSCIMO) para uma compra.
   *
   * Regras:
   * - Pode ter múltiplos ajustes (histórico).
   * - NÃO sobrescreve ajuste anterior.
   * - Recalcula total efetivo da compra.
   * - Recalcula paidCents e status.
   * - Gera auditoria.
   *
   * ✅ FIX importante:
   * - purchase.totalCents pode já estar “ajustado” por chamadas anteriores.
   * - Portanto, antes de aplicar novamente o somatório dos ajustes,
   *   reconstruímos o BASE (sem ajustes) a partir do estado atual:
   *     baseTotalCents = purchase.totalCents + descontosExistentes - acrescimosExistentes
   * - Depois aplicamos TODOS os ajustes (incluindo o novo) sobre o BASE.
   */
  async createPurchaseAdjustment(
    fairId: string,
    ownerId: string,
    purchaseId: string,
    dto: CreatePurchaseAdjustmentDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: {
          ownerFair: { select: { fairId: true, ownerId: true, fair: { select: { status: true } } } },
          installments: true,
          adjustments: true,
        },
      });

      if (!purchase) throw new NotFoundException('Compra não encontrada.');
      if (purchase.ownerFair.fair.status === FairStatus.FINALIZADA) {
        throw new BadRequestException('Ação não permitida em feira finalizada.');
      }

      if (purchase.ownerFair.fairId !== fairId)
        throw new BadRequestException('Compra não pertence à feira.');

      if (purchase.ownerFair.ownerId !== ownerId)
        throw new BadRequestException('Compra não pertence ao expositor.');

      const existingAdjustments = Array.isArray(purchase.adjustments)
        ? purchase.adjustments
        : [];

      // ✅ 1) Reconstrói BASE (sem ajustes) a partir do total atual + histórico existente
      const existingDiscount = existingAdjustments
        .filter((a) => a.type === AdjustmentType.DISCOUNT)
        .reduce((acc, a) => acc + Number(a.amountCents ?? 0), 0);

      const existingSurcharge = existingAdjustments
        .filter((a) => a.type === AdjustmentType.SURCHARGE)
        .reduce((acc, a) => acc + Number(a.amountCents ?? 0), 0);

      // base = totalEfetivoAtual + descontosExistentes - acrescimosExistentes
      // (assim removemos o efeito dos ajustes antigos do total atual)
      const baseTotalCents =
        Number(purchase.totalCents ?? 0) + existingDiscount - existingSurcharge;

      if (baseTotalCents < 0) {
        throw new BadRequestException(
          'Compra inválida: baseTotalCents negativo (inconsistência).',
        );
      }

      // ✅ 2) Cria histórico do ajuste
      const adjustment = await tx.ownerFairPurchaseAdjustment.create({
        data: {
          purchaseId,
          type: dto.type,
          amountCents: dto.amountCents,
          reason: dto.reason ?? null,
          createdByUserId: actorUserId,
        },
      });

      // ✅ 3) Recalcula total efetivo a partir do BASE + TODOS os ajustes (incluindo o novo)
      const allAdjustments = [...existingAdjustments, adjustment];

      const totalDiscount = allAdjustments
        .filter((a) => a.type === AdjustmentType.DISCOUNT)
        .reduce((acc, a) => acc + Number(a.amountCents ?? 0), 0);

      const totalSurcharge = allAdjustments
        .filter((a) => a.type === AdjustmentType.SURCHARGE)
        .reduce((acc, a) => acc + Number(a.amountCents ?? 0), 0);

      const effectiveTotalCents =
        baseTotalCents - totalDiscount + totalSurcharge;

      if (effectiveTotalCents < 0) {
        throw new BadRequestException(
          'Ajustes deixam o total negativo. Operação inválida.',
        );
      }

      // 🔥 recalcula financeiros usando o TOTAL EFETIVO
      const now = new Date();
      const computed = this.computePurchaseFinancials({
        totalCents: effectiveTotalCents,
        installments: (purchase.installments ?? []).map((i) => ({
          dueDate: i.dueDate,
          amountCents: i.amountCents,
          paidAt: i.paidAt,
          paidAmountCents: i.paidAmountCents,
        })),
        now,
      });

      const updatedPurchase = await tx.ownerFairPurchase.update({
        where: { id: purchaseId },
        data: {
          // ⚠️ Mantendo sua decisão atual: totalCents vira o total efetivo
          totalCents: effectiveTotalCents,
          paidCents: computed.paidCents,
          status: computed.status,
          paidAt: computed.paidAt,
        },
      });

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.OWNER_FAIR_PURCHASE_PAYMENT,
        entityId: purchaseId,
        actorUserId,
        before: purchase,
        after: updatedPurchase,
        meta: {
          adjustmentType: dto.type,
          adjustmentAmount: dto.amountCents,

          baseTotalCents,

          existingDiscount,
          existingSurcharge,

          totalDiscount,
          totalSurcharge,
          effectiveTotalCents,
        },
      });

      return {
        ok: true,
        adjustment,
        purchase: updatedPurchase,
        totals: {
          baseTotalCents,
          originalTotal: purchase.totalCents, // (na sua modelagem atual, "original" é o total atual antes do update)
          existingDiscount,
          existingSurcharge,
          totalDiscount,
          totalSurcharge,
          effectiveTotalCents,
        },
      };
    });
  }
}
