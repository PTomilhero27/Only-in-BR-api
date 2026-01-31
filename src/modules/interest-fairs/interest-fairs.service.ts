import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LinkInterestToFairDto } from './dto/link-interest-to-fair.dto';
import { UpdateOwnerFairDto } from './dto/update-owner-fair.dto';
import type { JwtPayload } from 'src/common/types/jwt-payload.type';
import { AuditAction, AuditEntity, OwnerFairPaymentStatus, Prisma, StallSize } from '@prisma/client';


/**
 * Service que centraliza a regra de negócio do vínculo Owner ↔ Fair.
 *
 * Regras:
 * - stallsQty é DERIVADO da soma de stallSlots
 * - persiste Plano de Pagamento + Parcelas
 * - valida capacidade da feira (stallsCapacity) no create e no update
 *
 * Capacidade (decisão A):
 * - "reservado" = soma de OwnerFair.stallsQty na feira
 */
@Injectable()
export class InterestFairsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------
  // Helpers: Slots
  // ---------------------------------------------
  private validateAndSumSlots(
    slots: Array<{ stallSize: StallSize; qty: number; unitPriceCents: number }>,
  ): number {
    if (!slots || slots.length === 0) {
      throw new BadRequestException(
        'Informe ao menos um tamanho na compra de barracas.',
      );
    }

    const seen = new Set<StallSize>();
    let total = 0;

    for (const s of slots) {
      if (seen.has(s.stallSize)) {
        throw new BadRequestException(
          'Não é permitido repetir o mesmo tamanho de barraca.',
        );
      }
      seen.add(s.stallSize);

      if (!Number.isInteger(s.qty) || s.qty < 1) {
        throw new BadRequestException('qty deve ser inteiro >= 1.');
      }

      if (!Number.isInteger(s.unitPriceCents) || s.unitPriceCents < 0) {
        throw new BadRequestException('unitPriceCents deve ser inteiro >= 0.');
      }

      total += s.qty;
    }

    if (total < 1 || total > 100) {
      throw new BadRequestException(
        'O total de barracas (soma das quantidades por tamanho) deve ficar entre 1 e 100.',
      );
    }

    return total;
  }

  private sumSlotsTotalCents(
    slots: Array<{ qty: number; unitPriceCents: number }>,
  ): number {
    return slots.reduce((acc, s) => {
      const qty = Number.isFinite(s.qty) ? s.qty : 0;
      const unit = Number.isFinite(s.unitPriceCents) ? s.unitPriceCents : 0;
      return acc + qty * unit;
    }, 0);
  }

  // ---------------------------------------------
  // Helpers: Capacidade
  // ---------------------------------------------
  private async assertFairCapacity(params: {
    fairId: string;
    stallsQtyToReserve: number;
    /**
     * Se for UPDATE: passe o id do OwnerFair atual pra excluir do "reservado"
     */
    excludeOwnerFairId?: string;
  }) {
    const fair = await this.prisma.fair.findUnique({
      where: { id: params.fairId },
      select: { id: true, stallsCapacity: true },
    });

    if (!fair) throw new NotFoundException('Feira não encontrada.');

    if (!Number.isInteger(fair.stallsCapacity) || fair.stallsCapacity <= 0) {
      throw new BadRequestException(
        'Esta feira ainda não possui capacidade configurada. Defina stallsCapacity no cadastro da feira.',
      );
    }

    if (
      !Number.isInteger(params.stallsQtyToReserve) ||
      params.stallsQtyToReserve < 1
    ) {
      throw new BadRequestException('A compra deve ter ao menos 1 barraca.');
    }

    const reservedAgg = await this.prisma.ownerFair.aggregate({
      where: {
        fairId: params.fairId,
        ...(params.excludeOwnerFairId
          ? { id: { not: params.excludeOwnerFairId } }
          : {}),
      },
      _sum: { stallsQty: true },
    });

    const reserved = reservedAgg._sum.stallsQty ?? 0;
    const remaining = Math.max(0, fair.stallsCapacity - reserved);

    if (params.stallsQtyToReserve > remaining) {
      throw new BadRequestException(
        `A compra (${params.stallsQtyToReserve}) ultrapassa as vagas restantes da feira (${remaining}).`,
      );
    }

    return { capacity: fair.stallsCapacity, reserved, remaining };
  }

  // ---------------------------------------------
  // Helpers: Payment Plan
  // ---------------------------------------------
  private parseDateOnlyOrThrow(value: string, fieldName: string): Date {
    // Esperado: YYYY-MM-DD
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(`Informe ${fieldName}.`);
    }

    // "YYYY-MM-DD" -> "YYYY-MM-DDT00:00:00.000Z"
    const iso = `${value}T00:00:00.000Z`;
    const d = new Date(iso);

    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${fieldName} inválido: "${value}".`);
    }
    return d;
  }

  private computePaymentStatus(input: {
    installments: Array<{ dueDate: Date; paidAt: Date | null }>;
  }): OwnerFairPaymentStatus {
    const now = new Date();
    const total = input.installments.length;
    const paid = input.installments.filter((i) => !!i.paidAt).length;

    if (total === 0) return OwnerFairPaymentStatus.PENDING;

    const anyOverdue = input.installments.some(
      (i) => !i.paidAt && i.dueDate < now,
    );

    if (paid === 0) return anyOverdue ? OwnerFairPaymentStatus.OVERDUE : OwnerFairPaymentStatus.PENDING;
    if (paid < total) return anyOverdue ? OwnerFairPaymentStatus.OVERDUE : OwnerFairPaymentStatus.PARTIALLY_PAID;
    return OwnerFairPaymentStatus.PAID;
  }

  /**
   * Valida paymentPlan do payload.
   * Regras:
   * - installmentsCount 1..12
   * - installments.length === installmentsCount
   * - number 1..N (sem repetição)
   * - dueDate obrigatório
   * - amountCents >= 0
   * - soma(amountCents) == totalCents
   * - paidAt (se vier) deve ser date-only válido
   * - paidAmountCents (se vier) >= 0
   */
  private validatePaymentPlanOrThrow(plan: any) {
    if (!plan || typeof plan !== 'object') {
      throw new BadRequestException('Informe paymentPlan.');
    }

    const installmentsCount = Number(plan.installmentsCount);
    const totalCents = Number(plan.totalCents);

    if (
      !Number.isInteger(installmentsCount) ||
      installmentsCount < 1 ||
      installmentsCount > 12
    ) {
      throw new BadRequestException(
        'installmentsCount deve ser inteiro entre 1 e 12.',
      );
    }

    if (!Number.isInteger(totalCents) || totalCents < 0) {
      throw new BadRequestException('totalCents deve ser inteiro >= 0.');
    }

    if (!Array.isArray(plan.installments) || plan.installments.length !== installmentsCount) {
      throw new BadRequestException(
        'A lista de parcelas não confere com installmentsCount.',
      );
    }

    const seen = new Set<number>();
    let sum = 0;

    for (const ins of plan.installments) {
      const number = Number(ins.number);
      if (!Number.isInteger(number) || number < 1 || number > installmentsCount) {
        throw new BadRequestException('Cada parcela deve ter number válido (1..N).');
      }
      if (seen.has(number)) {
        throw new BadRequestException('Não é permitido repetir number de parcela.');
      }
      seen.add(number);

      if (!ins.dueDate || typeof ins.dueDate !== 'string') {
        throw new BadRequestException('Informe a data de vencimento de todas as parcelas.');
      }
      // valida formato
      this.parseDateOnlyOrThrow(ins.dueDate, 'dueDate');

      const amountCents = Number(ins.amountCents);
      if (!Number.isInteger(amountCents) || amountCents < 0) {
        throw new BadRequestException('amountCents deve ser inteiro >= 0.');
      }
      sum += amountCents;

      if (ins.paidAt != null) {
        if (typeof ins.paidAt !== 'string') {
          throw new BadRequestException('paidAt inválido.');
        }
        this.parseDateOnlyOrThrow(ins.paidAt, 'paidAt');

        if (ins.paidAmountCents != null) {
          const paidAmountCents = Number(ins.paidAmountCents);
          if (!Number.isInteger(paidAmountCents) || paidAmountCents < 0) {
            throw new BadRequestException('paidAmountCents deve ser inteiro >= 0.');
          }
        }
      }
    }

    if (sum !== totalCents) {
      throw new BadRequestException('A soma das parcelas deve ser igual ao total.');
    }

    return { installmentsCount, totalCents };
  }

  private toAuditJson(value: unknown): Prisma.InputJsonValue {
    // Prisma Json aceita null, boolean, number, string, arrays e objetos.
    // Aqui garantimos compatibilidade de tipo para TS.
    return value as Prisma.InputJsonValue;
  }

  // ---------------------------------------------
  // Queries
  // ---------------------------------------------
  async listByOwner(ownerId: string) {
    const owner = await this.prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Interessado não encontrado.');

    const links = await this.prisma.ownerFair.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        fair: { select: { id: true, name: true } },
        stallSlots: { orderBy: { stallSize: 'asc' } },
        paymentPlan: {
          include: { installments: { orderBy: { number: 'asc' } } },
        },
      },
    });

    return {
      ownerId,
      items: links.map((l) => ({
        fairId: l.fairId,
        fairName: l.fair.name,
        stallsQty: l.stallsQty,
        stallSlots: l.stallSlots.map((s) => ({
          stallSize: s.stallSize,
          qty: s.qty,
          unitPriceCents: s.unitPriceCents,
        })),
        paymentPlan: l.paymentPlan
          ? {
              installmentsCount: l.paymentPlan.installmentsCount,
              totalCents: l.paymentPlan.totalCents,
              status: l.paymentPlan.status,
              installments: l.paymentPlan.installments.map((i) => ({
                number: i.number,
                dueDate: i.dueDate.toISOString().slice(0, 10),
                amountCents: i.amountCents,
                paidAt: i.paidAt ? i.paidAt.toISOString().slice(0, 10) : null,
                paidAmountCents: i.paidAmountCents ?? null,
              })),
            }
          : null,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
    };
  }

  // ---------------------------------------------
  // Create Link
  // ---------------------------------------------
  async link(ownerId: string, dto: LinkInterestToFairDto, actor: JwtPayload) {
    const [owner, fair] = await Promise.all([
      this.prisma.owner.findUnique({ where: { id: ownerId } }),
      this.prisma.fair.findUnique({ where: { id: dto.fairId } }),
    ]);

    if (!owner) throw new NotFoundException('Interessado não encontrado.');
    if (!fair) throw new NotFoundException('Feira não encontrada.');

    const existing = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId: dto.fairId } },
      include: { stallSlots: true, paymentPlan: true },
    });
    if (existing) {
      throw new ConflictException('Este interessado já está vinculado a esta feira.');
    }

    const stallsQty = this.validateAndSumSlots(dto.stallSlots);

    await this.assertFairCapacity({
      fairId: dto.fairId,
      stallsQtyToReserve: stallsQty,
    });

    this.validatePaymentPlanOrThrow(dto.paymentPlan);

    const slotsTotalCents = this.sumSlotsTotalCents(dto.stallSlots);

    // Se você quiser permitir negociação, remova esse bloqueio.
    if (dto.paymentPlan.totalCents !== slotsTotalCents) {
      throw new BadRequestException(
        `totalCents do pagamento (${dto.paymentPlan.totalCents}) deve ser igual ao total da compra (${slotsTotalCents}).`,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const ownerFair = await tx.ownerFair.create({
        data: {
          ownerId,
          fairId: dto.fairId,
          stallsQty,
          stallSlots: {
            create: dto.stallSlots.map((s) => ({
              stallSize: s.stallSize,
              qty: s.qty,
              unitPriceCents: s.unitPriceCents,
            })),
          },
          paymentPlan: {
            create: {
              totalCents: dto.paymentPlan.totalCents,
              installmentsCount: dto.paymentPlan.installmentsCount,
              status: OwnerFairPaymentStatus.PENDING, // recalculado abaixo
              installments: {
                create: dto.paymentPlan.installments.map((i) => ({
                  number: i.number,
                  dueDate: this.parseDateOnlyOrThrow(i.dueDate, 'dueDate'),
                  amountCents: i.amountCents,
                  paidAt: i.paidAt
                    ? this.parseDateOnlyOrThrow(i.paidAt, 'paidAt')
                    : null,
                  paidAmountCents: i.paidAmountCents ?? null,
                })),
              },
            },
          },
        },
        include: {
          stallSlots: true,
          paymentPlan: { include: { installments: true } },
        },
      });

      // Recalcula status
      if (ownerFair.paymentPlan) {
        const status = this.computePaymentStatus({
          installments: ownerFair.paymentPlan.installments.map((i) => ({
            dueDate: i.dueDate,
            paidAt: i.paidAt,
          })),
        });

        await tx.ownerFairPaymentPlan.update({
          where: { ownerFairId: ownerFair.id },
          data: { status },
        });
      }

      return ownerFair;
    });

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        entity: AuditEntity.OWNER_FAIR,
        entityId: created.id,
        actorUserId: actor.id,
        before: this.toAuditJson({}),
        after: this.toAuditJson({
          ownerId: created.ownerId,
          fairId: created.fairId,
          stallsQty: created.stallsQty,
          stallSlots: created.stallSlots.map((s) => ({
            stallSize: s.stallSize,
            qty: s.qty,
            unitPriceCents: s.unitPriceCents,
          })),
          paymentPlan: created.paymentPlan
            ? {
                totalCents: created.paymentPlan.totalCents,
                installmentsCount: created.paymentPlan.installmentsCount,
                status: created.paymentPlan.status,
                installments: created.paymentPlan.installments.map((i) => ({
                  number: i.number,
                  dueDate: i.dueDate.toISOString().slice(0, 10),
                  amountCents: i.amountCents,
                  paidAt: i.paidAt ? i.paidAt.toISOString().slice(0, 10) : null,
                  paidAmountCents: i.paidAmountCents ?? null,
                })),
              }
            : null,
        }),
      },
    });

    return created;
  }

  // ---------------------------------------------
  // Update Link
  // ---------------------------------------------
  async update(ownerId: string, fairId: string, dto: UpdateOwnerFairDto, actor: JwtPayload) {
    const existing = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId } },
      include: {
        stallSlots: true,
        paymentPlan: { include: { installments: true } },
      },
    });

    if (!existing) throw new NotFoundException('Vínculo não encontrado.');

    if (!dto.stallSlots || dto.stallSlots.length === 0) {
      throw new BadRequestException('Informe stallSlots para atualizar a compra.');
    }
    if (!dto.paymentPlan) {
      throw new BadRequestException('Informe paymentPlan para atualizar o pagamento.');
    }

    const stallsQty = this.validateAndSumSlots(dto.stallSlots);

    await this.assertFairCapacity({
      fairId,
      stallsQtyToReserve: stallsQty,
      excludeOwnerFairId: existing.id,
    });

    this.validatePaymentPlanOrThrow(dto.paymentPlan);

    const slotsTotalCents = this.sumSlotsTotalCents(dto.stallSlots);
    if (dto.paymentPlan.totalCents !== slotsTotalCents) {
      throw new BadRequestException(
        `totalCents do pagamento (${dto.paymentPlan.totalCents}) deve ser igual ao total da compra (${slotsTotalCents}).`,
      );
    }

    const beforeObj = {
      ownerId: existing.ownerId,
      fairId: existing.fairId,
      stallsQty: existing.stallsQty,
      stallSlots: existing.stallSlots.map((s) => ({
        stallSize: s.stallSize,
        qty: s.qty,
        unitPriceCents: s.unitPriceCents,
      })),
      paymentPlan: existing.paymentPlan
        ? {
            totalCents: existing.paymentPlan.totalCents,
            installmentsCount: existing.paymentPlan.installmentsCount,
            status: existing.paymentPlan.status,
            installments: existing.paymentPlan.installments.map((i) => ({
              number: i.number,
              dueDate: i.dueDate.toISOString().slice(0, 10),
              amountCents: i.amountCents,
              paidAt: i.paidAt ? i.paidAt.toISOString().slice(0, 10) : null,
              paidAmountCents: i.paidAmountCents ?? null,
            })),
          }
        : null,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1) atualiza stallsQty
      const ownerFair = await tx.ownerFair.update({
        where: { ownerId_fairId: { ownerId, fairId } },
        data: { stallsQty },
      });

      // 2) substitui slots
      await tx.ownerFairStallSlot.deleteMany({
        where: { ownerFairId: existing.id },
      });

      await tx.ownerFairStallSlot.createMany({
        data: dto.stallSlots!.map((s) => ({
          ownerFairId: existing.id,
          stallSize: s.stallSize,
          qty: s.qty,
          unitPriceCents: s.unitPriceCents,
        })),
      });

      // 3) substitui paymentPlan + installments
      const plan = await tx.ownerFairPaymentPlan.findUnique({
        where: { ownerFairId: existing.id },
        select: { id: true },
      });

      const installmentsParsed = dto.paymentPlan.installments.map((i) => ({
        number: i.number,
        dueDate: this.parseDateOnlyOrThrow(i.dueDate, 'dueDate'),
        amountCents: i.amountCents,
        paidAt: i.paidAt ? this.parseDateOnlyOrThrow(i.paidAt, 'paidAt') : null,
        paidAmountCents: i.paidAmountCents ?? null,
      }));

      const status = this.computePaymentStatus({
        installments: installmentsParsed.map((x) => ({
          dueDate: x.dueDate,
          paidAt: x.paidAt,
        })),
      });

      if (plan) {
        await tx.ownerFairPaymentPlan.update({
          where: { ownerFairId: existing.id },
          data: {
            totalCents: dto.paymentPlan.totalCents,
            installmentsCount: dto.paymentPlan.installmentsCount,
            status,
          },
        });

        await tx.ownerFairInstallment.deleteMany({ where: { planId: plan.id } });

        await tx.ownerFairInstallment.createMany({
          data: installmentsParsed.map((i) => ({
            planId: plan.id,
            number: i.number,
            dueDate: i.dueDate,
            amountCents: i.amountCents,
            paidAt: i.paidAt,
            paidAmountCents: i.paidAmountCents,
          })),
        });
      } else {
        await tx.ownerFairPaymentPlan.create({
          data: {
            ownerFairId: existing.id,
            totalCents: dto.paymentPlan.totalCents,
            installmentsCount: dto.paymentPlan.installmentsCount,
            status,
            installments: { create: installmentsParsed },
          },
        });
      }

      return ownerFair;
    });

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entity: AuditEntity.OWNER_FAIR,
        entityId: existing.id,
        actorUserId: actor.id,
        before: this.toAuditJson(beforeObj),
        after: this.toAuditJson({
          ownerId,
          fairId,
          stallsQty,
          stallSlots: dto.stallSlots.map((s) => ({
            stallSize: s.stallSize,
            qty: s.qty,
            unitPriceCents: s.unitPriceCents,
          })),
          paymentPlan: dto.paymentPlan,
        }),
      },
    });

    return updated;
  }

  // ---------------------------------------------
  // Remove Link
  // ---------------------------------------------
  async remove(ownerId: string, fairId: string, actor: JwtPayload) {
    const existing = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId } },
      include: {
        stallSlots: true,
        paymentPlan: { include: { installments: true } },
      },
    });

    if (!existing) throw new NotFoundException('Vínculo não encontrado.');

    const beforeObj = {
      ownerId: existing.ownerId,
      fairId: existing.fairId,
      stallsQty: existing.stallsQty,
      stallSlots: existing.stallSlots.map((s) => ({
        stallSize: s.stallSize,
        qty: s.qty,
        unitPriceCents: s.unitPriceCents,
      })),
      paymentPlan: existing.paymentPlan
        ? {
            totalCents: existing.paymentPlan.totalCents,
            installmentsCount: existing.paymentPlan.installmentsCount,
            status: existing.paymentPlan.status,
            installments: existing.paymentPlan.installments.map((i) => ({
              number: i.number,
              dueDate: i.dueDate.toISOString().slice(0, 10),
              amountCents: i.amountCents,
              paidAt: i.paidAt ? i.paidAt.toISOString().slice(0, 10) : null,
              paidAmountCents: i.paidAmountCents ?? null,
            })),
          }
        : null,
    };

    await this.prisma.ownerFair.delete({
      where: { ownerId_fairId: { ownerId, fairId } },
    });

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.DELETE,
        entity: AuditEntity.OWNER_FAIR,
        entityId: existing.id,
        actorUserId: actor.id,
        before: this.toAuditJson(beforeObj),
        after: this.toAuditJson({}),
      },
    });

    return { ok: true };
  }
}
