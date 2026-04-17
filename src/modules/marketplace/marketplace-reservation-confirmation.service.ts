import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  FairStatus,
  MarketplaceInterestStatus,
  MarketplaceReservationStatus,
  MarketplaceSlotStatus,
  OwnerFairPaymentStatus,
  OwnerFairStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MarketplaceReservationConfirmationInput,
  MarketplaceReservationConfirmationResult,
} from './types/reservation-confirmation.type';

@Injectable()
export class MarketplaceReservationConfirmationService {
  constructor(private readonly prisma: PrismaService) {}

  private toAuditJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private parseDateOnlyOrThrow(value: string, fieldName: string): Date {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(`Informe ${fieldName}.`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} inválido: "${value}".`);
    }

    return date;
  }

  private computePurchasePaymentStatus(input: {
    totalCents: number;
    paidCents: number;
    installments: Array<{ dueDate: Date; paidAt: Date | null }>;
  }): OwnerFairPaymentStatus {
    const remaining = Math.max(0, input.totalCents - input.paidCents);
    if (remaining === 0) return OwnerFairPaymentStatus.PAID;

    const total = input.installments.length;
    if (total === 0) return OwnerFairPaymentStatus.PENDING;

    const now = new Date();
    const paid = input.installments.filter((item) => !!item.paidAt).length;
    const anyOverdue = input.installments.some(
      (item) => !item.paidAt && item.dueDate < now,
    );

    if (paid === 0) {
      return anyOverdue
        ? OwnerFairPaymentStatus.OVERDUE
        : OwnerFairPaymentStatus.PENDING;
    }

    if (paid < total) {
      return anyOverdue
        ? OwnerFairPaymentStatus.OVERDUE
        : OwnerFairPaymentStatus.PARTIALLY_PAID;
    }

    return OwnerFairPaymentStatus.PAID;
  }

  private validatePurchaseLineOrThrow(input: {
    unitPriceCents: number;
    paidCents?: number;
    installmentsCount?: number;
    installments?: Array<{
      number: number;
      dueDate: string;
      amountCents: number;
      paidAt?: string | null;
      paidAmountCents?: number | null;
    }>;
  }) {
    const qty = 1;
    const unitPriceCents = Number(input.unitPriceCents);
    const paidCents = Number(input.paidCents ?? 0);
    const installmentsCount = Number(input.installmentsCount ?? 0);

    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
      throw new BadRequestException('unitPriceCents deve ser inteiro >= 0.');
    }

    const totalCents = qty * unitPriceCents;

    if (!Number.isInteger(paidCents) || paidCents < 0) {
      throw new BadRequestException('paidCents deve ser inteiro >= 0.');
    }

    if (paidCents > totalCents) {
      throw new BadRequestException(
        'paidCents não pode ser maior que o valor da barraca.',
      );
    }

    if (
      !Number.isInteger(installmentsCount) ||
      installmentsCount < 0 ||
      installmentsCount > 12
    ) {
      throw new BadRequestException(
        'installmentsCount deve ser inteiro entre 0 e 12.',
      );
    }

    const remaining = totalCents - paidCents;

    if (remaining === 0) {
      if (installmentsCount !== 0) {
        throw new BadRequestException(
          'Sem restante: installmentsCount deve ser 0.',
        );
      }

      if (input.installments?.length) {
        throw new BadRequestException(
          'Sem restante: installments deve estar vazio.',
        );
      }

      return {
        qty,
        unitPriceCents,
        totalCents,
        paidCents,
        installmentsCount: 0,
        installmentsParsed: [] as Array<{
          number: number;
          dueDate: Date;
          amountCents: number;
          paidAt: Date | null;
          paidAmountCents: number | null;
        }>,
        status: OwnerFairPaymentStatus.PAID,
      };
    }

    if (installmentsCount === 0) {
      throw new BadRequestException(
        'Existe valor restante: informe installmentsCount > 0 e a lista de parcelas.',
      );
    }

    if (
      !Array.isArray(input.installments) ||
      input.installments.length !== installmentsCount
    ) {
      throw new BadRequestException(
        'A lista de parcelas não confere com installmentsCount.',
      );
    }

    const seen = new Set<number>();
    let sum = 0;

    const installmentsParsed = input.installments.map((installment) => {
      const number = Number(installment.number);
      if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > installmentsCount
      ) {
        throw new BadRequestException(
          'Cada parcela deve ter number válido (1..N).',
        );
      }

      if (seen.has(number)) {
        throw new BadRequestException(
          'Não é permitido repetir number de parcela.',
        );
      }
      seen.add(number);

      const dueDate = this.parseDateOnlyOrThrow(
        installment.dueDate,
        'dueDate',
      );

      const amountCents = Number(installment.amountCents);
      if (!Number.isInteger(amountCents) || amountCents < 0) {
        throw new BadRequestException('amountCents deve ser inteiro >= 0.');
      }
      sum += amountCents;

      const paidAt = installment.paidAt
        ? this.parseDateOnlyOrThrow(installment.paidAt, 'paidAt')
        : null;

      let paidAmountCents: number | null = null;
      if (installment.paidAmountCents != null) {
        const value = Number(installment.paidAmountCents);
        if (!Number.isInteger(value) || value < 0) {
          throw new BadRequestException(
            'paidAmountCents deve ser inteiro >= 0.',
          );
        }
        paidAmountCents = value;
      }

      return {
        number,
        dueDate,
        amountCents,
        paidAt,
        paidAmountCents,
      };
    });

    if (sum !== remaining) {
      throw new BadRequestException(
        `A soma das parcelas (${sum}) deve ser igual ao restante (${remaining}).`,
      );
    }

    const status = this.computePurchasePaymentStatus({
      totalCents,
      paidCents,
      installments: installmentsParsed.map((installment) => ({
        dueDate: installment.dueDate,
        paidAt: installment.paidAt,
      })),
    });

    return {
      qty,
      unitPriceCents,
      totalCents,
      paidCents,
      installmentsCount,
      installmentsParsed,
      status,
    };
  }

  private async recomputeAndApplyOwnerFairStatus(
    tx: Prisma.TransactionClient,
    ownerFairId: string,
    actorUserId: string,
    meta?: Record<string, unknown>,
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

    const purchasedQty = purchases.reduce((acc, purchase) => {
      return acc + (purchase.qty ?? 0);
    }, 0);
    const linkedQty = ownerFair.stallFairs?.length ?? 0;

    const totalCents = purchases.reduce((acc, purchase) => {
      return acc + (purchase.totalCents ?? 0);
    }, 0);
    const paidCents = purchases.reduce((acc, purchase) => {
      return acc + (purchase.paidCents ?? 0);
    }, 0);
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

    const before = {
      id: ownerFair.id,
      status: ownerFair.status,
    };

    const after = await tx.ownerFair.update({
      where: { id: ownerFair.id },
      data: { status: effectiveStatus },
      select: {
        id: true,
        status: true,
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entity: AuditEntity.OWNER_FAIR,
        entityId: after.id,
        actorUserId,
        before: this.toAuditJson(before),
        after: this.toAuditJson(after),
        meta: this.toAuditJson({
          reason: 'marketplace_reservation_confirmation_recompute',
          missing,
          purchasedQty,
          linkedQty,
          totalCents,
          paidCents,
          remainingCents,
          isSigned,
          ...meta,
        }),
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

  async confirm(
    input: MarketplaceReservationConfirmationInput,
  ): Promise<MarketplaceReservationConfirmationResult> {
    if (!input.payment.approval.approved) {
      throw new BadRequestException(
        'O pagamento ainda não foi aprovado para confirmar a reserva.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.marketplaceSlotReservation.findUnique({
        where: { id: input.reservationId },
        include: {
          fair: {
            select: {
              id: true,
              name: true,
              status: true,
              stallsCapacity: true,
            },
          },
          fairMapSlot: {
            select: {
              id: true,
              fairId: true,
              fairMapId: true,
              fairMapElementId: true,
              commercialStatus: true,
              label: true,
              code: true,
            },
          },
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
          stall: {
            select: {
              id: true,
              ownerId: true,
              pdvName: true,
              stallSize: true,
              stallType: true,
            },
          },
        },
      });

      if (!reservation) {
        throw new NotFoundException('Reserva não encontrada.');
      }

      if (reservation.status !== MarketplaceReservationStatus.ACTIVE) {
        throw new BadRequestException(
          'Somente reservas ativas podem ser confirmadas.',
        );
      }

      if (reservation.fair.status === FairStatus.FINALIZADA) {
        throw new BadRequestException(
          'Não é possível confirmar reserva em uma feira finalizada.',
        );
      }

      const selectedStallId =
        input.binding?.stallId ?? reservation.stallId ?? null;

      const selectedStall = selectedStallId
        ? await tx.stall.findUnique({
            where: { id: selectedStallId },
            select: {
              id: true,
              ownerId: true,
              pdvName: true,
              stallSize: true,
              stallType: true,
            },
          })
        : null;

      if (selectedStallId && !selectedStall) {
        throw new NotFoundException(
          'Barraca informada para confirmação não foi encontrada.',
        );
      }

      if (selectedStall && selectedStall.ownerId !== reservation.ownerId) {
        throw new BadRequestException(
          'A barraca vinculada na confirmação não pertence ao expositor da reserva.',
        );
      }

      if (
        selectedStall &&
        reservation.selectedTentType &&
        selectedStall.stallSize !== reservation.selectedTentType
      ) {
        throw new BadRequestException(
          'A barraca escolhida na confirmação não é compatível com o tipo reservado.',
        );
      }

      const stallSize =
        selectedStall?.stallSize ?? reservation.selectedTentType;

      if (!stallSize) {
        throw new BadRequestException(
          'A reserva precisa ter um tipo de barraca definido antes da confirmação.',
        );
      }

      const slotLink = await tx.fairMapBoothLink.findUnique({
        where: {
          fairMapId_slotClientKey: {
            fairMapId: reservation.fairMapSlot.fairMapId,
            slotClientKey: reservation.fairMapSlot.fairMapElementId,
          },
        },
        select: {
          id: true,
          stallFairId: true,
          slotClientKey: true,
        },
      });

      let existingOwnerFair = await tx.ownerFair.findUnique({
        where: {
          ownerId_fairId: {
            ownerId: reservation.ownerId,
            fairId: reservation.fairId,
          },
        },
        select: {
          id: true,
          stallsQty: true,
          status: true,
        },
      });

      let existingStallFair:
        | {
            id: string;
            ownerFairId: string;
            purchaseId: string;
            purchase: { id: string; status: OwnerFairPaymentStatus };
          }
        | null
        | undefined = null;

      if (selectedStallId) {
        existingStallFair = await tx.stallFair.findUnique({
          where: {
            stallId_fairId: {
              stallId: selectedStallId,
              fairId: reservation.fairId,
            },
          },
          select: {
            id: true,
            ownerFairId: true,
            purchaseId: true,
            purchase: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        });
      }

      const reservationLock = await tx.marketplaceSlotReservation.updateMany({
        where: {
          id: input.reservationId,
          status: MarketplaceReservationStatus.ACTIVE,
        },
        data: {
          status: MarketplaceReservationStatus.CONVERTED,
          expiresAt: null,
          stallId: selectedStallId,
          selectedTentType: stallSize,
        },
      });

      if (reservationLock.count === 0) {
        throw new ConflictException(
          'Esta reserva não está mais ativa para confirmação.',
        );
      }

      let ownerFairId = existingOwnerFair?.id ?? null;
      let purchaseId: string | null = existingStallFair?.purchaseId ?? null;
      let stallFairId: string | null = existingStallFair?.id ?? null;
      let paymentStatus: OwnerFairPaymentStatus | null =
        existingStallFair?.purchase.status ?? null;
      let ownerFairStatus: OwnerFairStatus | null =
        existingOwnerFair?.status ?? null;
      let createdOwnerFair = false;
      let createdPurchase = false;
      let createdStallFair = false;

      if (slotLink && !existingStallFair) {
        throw new ConflictException(
          'Este slot já está vinculado a outra barraca confirmada.',
        );
      }

      if (existingStallFair) {
        if (slotLink && slotLink.stallFairId !== existingStallFair.id) {
          throw new ConflictException(
            'Este slot já está vinculado a outra barraca confirmada.',
          );
        }

        const existingStallLink = await tx.fairMapBoothLink.findFirst({
          where: {
            fairMapId: reservation.fairMapSlot.fairMapId,
            stallFairId: existingStallFair.id,
          },
          select: {
            id: true,
            slotClientKey: true,
          },
        });

        if (
          existingStallLink &&
          existingStallLink.slotClientKey !== reservation.fairMapSlot.fairMapElementId
        ) {
          throw new ConflictException(
            'Esta barraca já está vinculada a outro slot nesta feira.',
          );
        }

        await tx.fairMapBoothLink.upsert({
          where: {
            fairMapId_slotClientKey: {
              fairMapId: reservation.fairMapSlot.fairMapId,
              slotClientKey: reservation.fairMapSlot.fairMapElementId,
            },
          },
          create: {
            fairMapId: reservation.fairMapSlot.fairMapId,
            slotClientKey: reservation.fairMapSlot.fairMapElementId,
            stallFairId: existingStallFair.id,
          },
          update: {
            stallFairId: existingStallFair.id,
          },
        });

        ownerFairId = existingStallFair.ownerFairId;
      } else {
        const validatedPurchase = this.validatePurchaseLineOrThrow({
          unitPriceCents: input.payment.unitPriceCents ?? reservation.priceCents,
          paidCents: input.payment.paidCents,
          installmentsCount: input.payment.installmentsCount,
          installments: input.payment.installments,
        });

        if (reservation.fair.stallsCapacity > 0) {
          const reservedAgg = await tx.ownerFair.aggregate({
            where: { fairId: reservation.fairId },
            _sum: { stallsQty: true },
          });

          const reserved = reservedAgg._sum.stallsQty ?? 0;
          const wouldReserve = reserved + 1;

          if (wouldReserve > reservation.fair.stallsCapacity) {
            throw new BadRequestException(
              `Capacidade excedida: reservado=${wouldReserve}, capacidade=${reservation.fair.stallsCapacity}.`,
            );
          }
        }

        if (!existingOwnerFair) {
          const ownerFair = await tx.ownerFair.create({
            data: {
              ownerId: reservation.ownerId,
              fairId: reservation.fairId,
              stallsQty: 0,
            },
            select: {
              id: true,
              stallsQty: true,
              status: true,
            },
          });

          existingOwnerFair = ownerFair;
          ownerFairId = ownerFair.id;
          ownerFairStatus = ownerFair.status;
          createdOwnerFair = true;

          await tx.auditLog.create({
            data: {
              action: AuditAction.CREATE,
              entity: AuditEntity.OWNER_FAIR,
              entityId: ownerFair.id,
              actorUserId: input.actorUserId,
              before: this.toAuditJson({}),
              after: this.toAuditJson({
                ownerId: reservation.ownerId,
                fairId: reservation.fairId,
                stallsQty: ownerFair.stallsQty,
                origin: 'marketplace_reservation_confirmation',
                source: input.source,
              }),
            },
          });
        }

        if (!ownerFairId) {
          throw new NotFoundException(
            'OwnerFair não encontrado para confirmar a reserva.',
          );
        }

        const purchase = await tx.ownerFairPurchase.create({
          data: {
            ownerFairId,
            stallSize,
            qty: validatedPurchase.qty,
            unitPriceCents: validatedPurchase.unitPriceCents,
            totalCents: validatedPurchase.totalCents,
            paidCents: validatedPurchase.paidCents,
            installmentsCount: validatedPurchase.installmentsCount,
            status: validatedPurchase.status,
            paidAt:
              validatedPurchase.status === OwnerFairPaymentStatus.PAID
                ? input.payment.approval.approvedAt ?? new Date()
                : null,
            usedQty: selectedStallId ? 1 : 0,
          },
          select: {
            id: true,
            status: true,
          },
        });

        createdPurchase = true;
        purchaseId = purchase.id;
        paymentStatus = purchase.status;

        if (validatedPurchase.installmentsCount > 0) {
          await tx.ownerFairPurchaseInstallment.createMany({
            data: validatedPurchase.installmentsParsed.map((installment) => ({
              purchaseId: purchase.id,
              number: installment.number,
              dueDate: installment.dueDate,
              amountCents: installment.amountCents,
              paidAt: installment.paidAt,
              paidAmountCents: installment.paidAmountCents,
            })),
          });
        }

        await tx.auditLog.create({
          data: {
            action: AuditAction.CREATE,
            entity: AuditEntity.OWNER_FAIR_PURCHASE,
            entityId: purchase.id,
            actorUserId: input.actorUserId,
            before: this.toAuditJson({}),
            after: this.toAuditJson({
              ownerFairId,
              stallSize,
              qty: validatedPurchase.qty,
              unitPriceCents: validatedPurchase.unitPriceCents,
              totalCents: validatedPurchase.totalCents,
              paidCents: validatedPurchase.paidCents,
              installmentsCount: validatedPurchase.installmentsCount,
              status: validatedPurchase.status,
              usedQty: selectedStallId ? 1 : 0,
              origin: 'marketplace_reservation_confirmation',
              source: input.source,
            }),
            meta: this.toAuditJson({
              reservationId: input.reservationId,
              ownerId: reservation.ownerId,
              fairId: reservation.fairId,
              approval: input.payment.approval,
            }),
          },
        });

        await tx.ownerFair.update({
          where: { id: ownerFairId },
          data: { stallsQty: { increment: 1 } },
        });

        if (selectedStallId) {
          const stallFair = await tx.stallFair.create({
            data: {
              fairId: reservation.fairId,
              stallId: selectedStallId,
              ownerFairId,
              purchaseId: purchase.id,
            },
            select: {
              id: true,
            },
          });

          createdStallFair = true;
          stallFairId = stallFair.id;

          await tx.auditLog.create({
            data: {
              action: AuditAction.CREATE,
              entity: AuditEntity.STALL_FAIR,
              entityId: stallFair.id,
              actorUserId: input.actorUserId,
              before: this.toAuditJson({}),
              after: this.toAuditJson({
                fairId: reservation.fairId,
                stallId: selectedStallId,
                ownerFairId,
                purchaseId: purchase.id,
                origin: 'marketplace_reservation_confirmation',
                source: input.source,
              }),
            },
          });

          await tx.fairMapBoothLink.create({
            data: {
              fairMapId: reservation.fairMapSlot.fairMapId,
              slotClientKey: reservation.fairMapSlot.fairMapElementId,
              stallFairId: stallFair.id,
            },
          });
        }

        const statusInfo = await this.recomputeAndApplyOwnerFairStatus(
          tx,
          ownerFairId,
          input.actorUserId,
          {
            reservationId: input.reservationId,
            createdOwnerFair,
            createdPurchase,
            createdStallFair,
            source: input.source,
            approval: input.payment.approval,
          },
        );

        ownerFairStatus = statusInfo.status;
      }

      await tx.marketplaceSlotInterest.updateMany({
        where: {
          fairId: reservation.fairId,
          fairMapSlotId: reservation.fairMapSlotId,
          ownerId: reservation.ownerId,
          status: {
            in: [
              MarketplaceInterestStatus.NEW,
              MarketplaceInterestStatus.CONTACTED,
              MarketplaceInterestStatus.NEGOTIATING,
            ],
          },
        },
        data: {
          status: MarketplaceInterestStatus.CONVERTED,
          expiresAt: null,
        },
      });

      await tx.fairMapSlot.update({
        where: { id: reservation.fairMapSlotId },
        data: {
          commercialStatus: MarketplaceSlotStatus.CONFIRMED,
        },
      });

      return {
        ok: true,
        reservationId: input.reservationId,
        reservationStatus: MarketplaceReservationStatus.CONVERTED,
        fairId: reservation.fairId,
        ownerId: reservation.ownerId,
        ownerFairId,
        ownerFairStatus,
        purchaseId,
        paymentStatus,
        stallFairId,
        createdOwnerFair,
        createdPurchase,
        createdStallFair,
        slotStatus: MarketplaceSlotStatus.CONFIRMED,
        source: input.source,
      };
    });
  }
}
