/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from 'src/common/audit/audit.service';

import { CreateFairDto } from './dto/create-fair-dto';
import { UpdateFairDto } from './dto/update-fair-dto';
import { ListFairsDto } from './dto/list-fair-dto';

import { UpdateExhibitorStatusDto } from './dto/exhibitors/update-exhibitor-status.dto';
import {
  AuditAction,
  AuditEntity,
  OwnerFairPaymentStatus,
  OwnerFairStatus,
} from '@prisma/client';
import {
  SettleInstallmentsAction,
  SettleStallInstallmentsDto,
} from './dto/exhibitors/settle-stall-installments.dto';

import { FairTaxUpsertDto } from './dto/fair-tax.dto';

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
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /**
   * Normaliza uma data "pura" (YYYY-MM-DD) para Date em UTC (00:00Z),
   * evitando bugs de timezone na UI e mantendo consistência no banco.
   */
  private parseDateOnlyToUTC(dateOnly: string) {
    // "2026-02-04" -> "2026-02-04T00:00:00.000Z"
    return new Date(`${dateOnly}T00:00:00.000Z`);
  }

  // ---------------------------------------------------------
  // Helpers (taxas por feira)
  // ---------------------------------------------------------

  /**
   * Aplica alterações nas taxas (% sobre vendas) com base no "estado final" enviado pelo front.
   *
   * Regras:
   * - id ausente => cria taxa
   * - id presente => atualiza taxa (somente se NÃO estiver em uso em OwnerFairPurchase)
   * - taxa existente que não vier na lista => tenta excluir (somente se NÃO estiver em uso)
   *
   * Por que assim:
   * - O front manda a lista final, e o backend faz o diff de forma determinística.
   */
  private async applyFairTaxesUpdate(
    tx: any,
    fairId: string,
    taxes: FairTaxUpsertDto[],
  ) {
    const existing = await tx.fairTax.findMany({
      where: { fairId },
      select: { id: true, name: true, percentBps: true },
      orderBy: { createdAt: 'asc' },
    });

    const incoming = Array.isArray(taxes) ? taxes : [];

    const incomingWithId = incoming.filter((t) => !!t.id);
    const incomingIds = new Set(incomingWithId.map((t) => t.id!));

    const incomingById = new Map(incomingWithId.map((t) => [t.id!, t]));

    const toDelete = existing.filter((t) => !incomingIds.has(t.id));
    const toUpdate = existing
      .filter((t) => incomingIds.has(t.id))
      .map((before) => ({
        before,
        next: incomingById.get(before.id)!,
      }));

    const toCreate = incoming.filter((t) => !t.id);

    const isTaxInUse = async (taxId: string) => {
      const usedCount = await tx.ownerFairPurchase.count({
        where: { taxId }, // ✅ se no seu schema for feeId, trocar aqui
      });
      return usedCount > 0;
    };

    // 1) bloquear deletes em uso
    for (const t of toDelete) {
      if (await isTaxInUse(t.id)) {
        throw new ConflictException(
          `Não é possível excluir a taxa "${t.name}" pois ela já está sendo usada em compras de barraca.`,
        );
      }
    }

    // 2) bloquear updates em uso (apenas se alterar algo)
    for (const u of toUpdate) {
      const changed =
        u.before.name !== u.next.name ||
        Number(u.before.percentBps) !== Number(u.next.percentBps);

      if (!changed) continue;

      if (await isTaxInUse(u.before.id)) {
        throw new ConflictException(
          `Não é possível editar a taxa "${u.before.name}" pois ela já está sendo usada em compras de barraca.`,
        );
      }
    }

    // 3) aplicar deletes
    if (toDelete.length) {
      await tx.fairTax.deleteMany({
        where: { id: { in: toDelete.map((t) => t.id) } },
      });
    }

    // 4) aplicar updates
    for (const u of toUpdate) {
      await tx.fairTax.update({
        where: { id: u.before.id },
        data: {
          name: u.next.name,
          percentBps: u.next.percentBps,
        },
      });
    }

    // 5) aplicar creates
    if (toCreate.length) {
      await tx.fairTax.createMany({
        data: toCreate.map((t) => ({
          fairId,
          name: t.name,
          percentBps: t.percentBps,
          isActive: true,
        })),
      });
    }
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
      // quando quitou, usamos a data do ÚLTIMO pagamento registrado (máxima)
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
      // se parcela ainda não quitou (paidAt null) e venceu
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
   *
   * Isso mantém o total pago coerente mesmo quando o Admin marca/desmarca parcelas.
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

    // entrada derivada (pode ser 0)
    const entryCents = Math.max(0, totalCents - installmentsTotal);

    const paidInstallmentsCents = installments.reduce((acc, i) => {
      if (!i.paidAt) return acc;
      const v = i.paidAmountCents ?? i.amountCents;
      return acc + Number(v ?? 0);
    }, 0);

    const paidCents = Math.min(totalCents, entryCents + paidInstallmentsCents);

    const now = input.now;
    const today0 = this.day0(now);

    const anyOverdue = installments.some((i) => {
      if (i.paidAt) return false;
      const due0 = this.day0(new Date(i.dueDate));
      return due0.getTime() < today0.getTime();
    });

    // Status por regra: PAID > OVERDUE > PARTIALLY_PAID > PENDING
    let status: OwnerFairPaymentStatus;
    if (paidCents >= totalCents && totalCents > 0)
      status = OwnerFairPaymentStatus.PAID;
    else if (anyOverdue) status = OwnerFairPaymentStatus.OVERDUE;
    else if (paidCents > 0) status = OwnerFairPaymentStatus.PARTIALLY_PAID;
    else status = OwnerFairPaymentStatus.PENDING;

    const paidAt = status === OwnerFairPaymentStatus.PAID ? now : null;

    return { paidCents, status, paidAt };
  }

  /**
   * Pagamento agregado do expositor:
   * - agora vem de purchases (OwnerFairPurchase)
   */
  private toAggregatedPaymentFromPurchases(purchases: any[]) {
    const totalCents = purchases.reduce(
      (acc, p) => acc + (p.totalCents ?? 0),
      0,
    );
    const paidCents = purchases.reduce((acc, p) => acc + (p.paidCents ?? 0), 0);

    const statuses: OwnerFairPaymentStatus[] = purchases.map(
      (p) =>
        (p.status as OwnerFairPaymentStatus) ?? OwnerFairPaymentStatus.PENDING,
    );

    const anyOverdue = statuses.includes(OwnerFairPaymentStatus.OVERDUE);
    const allPaid =
      statuses.length > 0 &&
      statuses.every((s) => s === OwnerFairPaymentStatus.PAID);
    const anyPaidLike = statuses.some(
      (s) =>
        s === OwnerFairPaymentStatus.PAID ||
        s === OwnerFairPaymentStatus.PARTIALLY_PAID,
    );

    const status = allPaid
      ? OwnerFairPaymentStatus.PAID
      : anyOverdue
        ? OwnerFairPaymentStatus.OVERDUE
        : anyPaidLike
          ? OwnerFairPaymentStatus.PARTIALLY_PAID
          : OwnerFairPaymentStatus.PENDING;

    return {
      status,
      totalCents,
      paidCents,
      purchasesCount: purchases.length,
    };
  }

  /**
   * Resumo de pagamento por COMPRA (para UI / modal de parcelas).
   * (substitui o antigo "por barraca" via paymentPlan)
   */
  private toPurchasePaymentSummary(p: any) {
    const installments = Array.isArray(p.installments) ? p.installments : [];

    const now = new Date();
    const today0 = this.day0(now);

    const paidCount = installments.filter((i: any) => !!i.paidAt).length;
    const overdueCount = installments.filter((i: any) => {
      if (i.paidAt) return false;
      const due0 = this.day0(new Date(i.dueDate));
      return due0.getTime() < today0.getTime();
    }).length;

    const nextOpen = installments
      .filter((i: any) => !i.paidAt)
      .sort(
        (a: any, b: any) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )[0];

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
    };
  }

  /**
   * Regra para status efetivo do expositor dentro da feira.
   * Responsabilidade:
   * - Calcular se está CONCLUIDO baseado em pagamento + contrato + barracas vinculadas
   * - Caso não esteja completo, mantém o status salvo no banco (controle operacional do Admin)
   */
  private computeEffectiveStatus(input: {
    savedStatus: OwnerFairStatus;
    contractSignedAt: Date | null;
    stallsQtyPurchased: number;
    stallsQtyLinked: number;
    isPaid: boolean;
  }): { status: OwnerFairStatus; isComplete: boolean } {
    const isComplete =
      input.isPaid &&
      !!input.contractSignedAt &&
      input.stallsQtyLinked >= input.stallsQtyPurchased;

    if (isComplete) {
      return { status: OwnerFairStatus.CONCLUIDO, isComplete: true };
    }

    return { status: input.savedStatus, isComplete: false };
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
          startsAt:
            ff.startsAt instanceof Date
              ? ff.startsAt.toISOString()
              : ff.startsAt,
          endsAt:
            ff.endsAt instanceof Date ? ff.endsAt.toISOString() : ff.endsAt,
        }))
      : undefined;

    // ✅ NOVO: taxes no retorno
    const taxes = Array.isArray(fair.taxes)
      ? fair.taxes.map((t: any) => ({
          id: t.id,
          name: t.name,
          percentBps: t.percentBps,
          isActive: t.isActive,
          createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
          updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
        }))
      : undefined;

    const ownerFairs = Array.isArray(fair.ownerFairs) ? fair.ownerFairs : [];
    const exhibitorsCount = ownerFairs.length;

    const stallsReserved = ownerFairs.reduce(
      (acc: number, x: any) => acc + (x.stallsQty ?? 0),
      0,
    );
    const stallsCapacity = Number(fair.stallsCapacity ?? 0);
    const stallsRemaining = Math.max(0, stallsCapacity - stallsReserved);

    return {
      ...fair,
      createdByName: fair.createdBy?.name ?? null,
      fairForms,
      taxes, // ✅ NOVO

      exhibitorsCount,
      stallsCapacity,
      stallsReserved,
      stallsRemaining,
      stallsQtyTotal: stallsReserved,

      createdBy: undefined,
      ownerFairs: undefined,
    };
  }

  // ---------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------

  /**
   * Cria uma feira + suas ocorrências.
   * Responsabilidade:
   * - Persistir Fair
   * - Persistir FairOccurrence (dias/horários não contíguos)
   * - ✅ Persistir FairTax (opcional)
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
      });

      await tx.fairOccurrence.createMany({
        data: dto.occurrences.map((o) => ({
          fairId: fair.id,
          startsAt: new Date(o.startsAt),
          endsAt: new Date(o.endsAt),
        })),
      });

      // ✅ NOVO: cria taxas se vierem
      if (dto.taxes?.length) {
        await tx.fairTax.createMany({
          data: dto.taxes.map((t) => ({
            fairId: fair.id,
            name: t.name,
            percentBps: t.percentBps,
            isActive: true,
          })),
        });
      }

      const after = await tx.fair.findUnique({
        where: { id: fair.id },
        include: {
          occurrences: true,
          createdBy: { select: { name: true } },

          // ✅ NOVO
          taxes: { orderBy: { createdAt: 'asc' } },

          ownerFairs: { select: { stallsQty: true } },
        },
      });

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.FAIR,
        entityId: fair.id,
        actorUserId,
        before: null,
        after,
      });

      return this.toFairResponse(after);
    });
  }

  /**
   * Atualiza dados da feira.
   * Responsabilidade:
   * - Impedir reduzir capacidade abaixo de barracas já reservadas
   * - ✅ Atualizar taxas por diff (com bloqueios)
   * - Registrar auditoria
   */
  async update(id: string, dto: UpdateFairDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.fair.findUnique({
        where: { id },
        include: {
          occurrences: true,
          createdBy: { select: { name: true } },

          // ✅ NOVO
          taxes: { orderBy: { createdAt: 'asc' } },

          ownerFairs: { select: { stallsQty: true } },
        },
      });
      if (!before) throw new NotFoundException('Feira não encontrada.');

      const stallsReserved = (before.ownerFairs ?? []).reduce(
        (acc: number, x: any) => acc + (x.stallsQty ?? 0),
        0,
      );

      if (
        dto.stallsCapacity !== undefined &&
        dto.stallsCapacity < stallsReserved
      ) {
        throw new BadRequestException(
          `Capacidade inválida. Já existem ${stallsReserved} barracas reservadas nesta feira.`,
        );
      }

      // ✅ IMPORTANTE: não pode mais fazer "data: dto" porque dto.taxes não é campo do Prisma
      await tx.fair.update({
        where: { id },
        data: {
          name: dto.name,
          address: dto.address,
          status: dto.status,
          stallsCapacity: dto.stallsCapacity,
        },
      });

      // ✅ NOVO: aplica diff das taxas se vier no payload
      if (dto.taxes) {
        await this.applyFairTaxesUpdate(tx, id, dto.taxes);
      }

      const after = await tx.fair.findUnique({
        where: { id },
        include: {
          occurrences: true,
          createdBy: { select: { name: true } },

          // ✅ NOVO
          taxes: { orderBy: { createdAt: 'asc' } },

          ownerFairs: { select: { stallsQty: true } },
        },
      });

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.FAIR,
        entityId: id,
        actorUserId,
        before,
        after,
      });

      return this.toFairResponse(after);
    });
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

        // ✅ NOVO
        taxes: { orderBy: { createdAt: 'asc' } },

        ownerFairs: { select: { stallsQty: true } },
      },
    });

    return fairs.map((f) => this.toFairResponse(f));
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
    /**
     * Lista expositores (OwnerFair) no contexto da feira com:
     * - Owner (contato + endereço + pagamento)
     * - compras (OwnerFairPurchase + installments)
     * - barracas vinculadas (StallFair + purchase consumida)
     * - ✅ taxa por barraca (StallFair.taxId + snapshots)
     * - ✅ catálogo de taxas da feira (Fair.taxes[])
     * - contrato (instância + aditivo)
     * - ✅ observações do admin (OwnerFair.observations)
     *
     * Decisão:
     * - Retornamos `fair.taxes` para a UI conseguir escolher taxa por barraca
     * - Retornamos `stallFair.taxSnapshot` para histórico contábil
     * - Retornamos `linkedStalls` com `stallFairId` (para PATCH da taxa)
     */

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

        // ✅ Taxas cadastradas na feira (catálogo para UI)
        taxes: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            percentBps: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },

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
    });

    if (!fair) throw new NotFoundException('Feira não encontrada.');

    const ownerFairs = await this.prisma.ownerFair.findMany({
      where: { fairId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fairId: true,
        ownerId: true,

        stallsQty: true,
        status: true,
        contractSignedAt: true,

        observations: true,

        createdAt: true,
        updatedAt: true,

        owner: {
          select: {
            id: true,
            personType: true,
            document: true,
            fullName: true,
            email: true,
            phone: true,

            addressFull: true,
            addressCity: true,
            addressState: true,
            addressZipcode: true,
            addressNumber: true,

            pixKey: true,
            bankName: true,
            bankAgency: true,
            bankAccount: true,
            bankAccountType: true,
            bankHolderDoc: true,
            bankHolderName: true,

            stallsDescription: true,
          },
        },

        stallFairs: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            stallId: true,
            createdAt: true,

            // ✅ taxa aplicada nesta barraca (snapshot)
            taxId: true,
            taxNameSnapshot: true,
            taxPercentBpsSnapshot: true,

            // (opcional) relação para fallback/debug. Mantém leve.
            tax: {
              select: {
                id: true,
                name: true,
                percentBps: true,
                isActive: true,
              },
            },

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
          select: {
            id: true,
            stallSize: true,
            qty: true,
            unitPriceCents: true,
            totalCents: true,
            paidCents: true,
            paidAt: true,
            installmentsCount: true,
            status: true,
            usedQty: true,
            createdAt: true,
            updatedAt: true,
            installments: {
              orderBy: { number: 'asc' },
              select: {
                id: true,
                number: true,
                dueDate: true,
                amountCents: true,
                paidAt: true,
                paidAmountCents: true,
                createdAt: true,
                updatedAt: true,
              },
            },
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
            signedAt: true,
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
    });

    const stallsReserved = ownerFairs.reduce(
      (acc, x) => acc + (x.stallsQty ?? 0),
      0,
    );
    const stallsCapacity = Number(fair.stallsCapacity ?? 0);
    const stallsRemaining = Math.max(0, stallsCapacity - stallsReserved);

    const items = ownerFairs.map((of) => {
      const stallFairs = Array.isArray(of.stallFairs) ? of.stallFairs : [];
      const purchases = Array.isArray(of.ownerFairPurchases)
        ? of.ownerFairPurchases
        : [];

      const stallsQtyLinked = stallFairs.length;

      const aggregatedPayment =
        this.toAggregatedPaymentFromPurchases(purchases);
      const isPaid = aggregatedPayment.status === OwnerFairPaymentStatus.PAID;

      const computed = this.computeEffectiveStatus({
        savedStatus: of.status as OwnerFairStatus,
        contractSignedAt: of.contractSignedAt,
        stallsQtyPurchased: of.stallsQty,
        stallsQtyLinked,
        isPaid: !!isPaid,
      });

      const signedAt = of.contractSignedAt
        ? of.contractSignedAt.toISOString()
        : null;
      const signUrl = signedAt
        ? null
        : of.contract?.signUrl
          ? of.contract.signUrl
          : of.contract?.assinafyDocumentId
            ? `https://app.assinafy.com.br/sign/${of.contract.assinafyDocumentId}`
            : null;

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
      };

      const purchasesPayments = purchases.map((p) =>
        this.toPurchasePaymentSummary(p),
      );

      // ✅ StallFairs com taxa (snapshot) para UI e auditoria
      const stallFairsLinked = stallFairs.map((sf) => ({
        stallFairId: sf.id,
        stallId: sf.stallId,
        createdAt: sf.createdAt.toISOString(),

        // ✅ snapshot de taxa aplicado nesta barraca (1 taxa por barraca)
        tax: sf.taxId
          ? {
              id: sf.taxId,
              name: sf.taxNameSnapshot ?? sf.tax?.name ?? null,
              percentBps:
                sf.taxPercentBpsSnapshot ?? sf.tax?.percentBps ?? null,
              isActive: sf.tax?.isActive ?? null,
            }
          : null,

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
      }));

      // ✅ linkedStalls agora precisa trazer stallFairId + tax (para a aba "Barracas" no modal)
      const linkedStalls = stallFairs.map((sf) => ({
        stallFairId: sf.id, // ✅ ESSENCIAL para PATCH taxa
        tax: sf.taxId
          ? {
              id: sf.taxId,
              name: sf.taxNameSnapshot ?? sf.tax?.name ?? null,
              percentBps:
                sf.taxPercentBpsSnapshot ?? sf.tax?.percentBps ?? null,
            }
          : null,
        ...sf.stall,
      }));

      return {
        ownerFairId: of.id,
        fairId: of.fairId,

        owner: of.owner,

        stallsQtyPurchased: of.stallsQty,
        stallsQtyLinked,
        linkedStalls,

        status: computed.status,
        isComplete: computed.isComplete,

        contractSignedAt: signedAt,

        observations: of.observations ?? null,

        payment: aggregatedPayment,

        purchasesPayments,
        stallFairs: stallFairsLinked,

        contract: contractSummary,
      };
    });

    return {
      fair: {
        id: fair.id,
        name: fair.name,
        status: fair.status,
        address: fair.address,

        stallsCapacity,
        stallsReserved,
        stallsRemaining,

        // ✅ catálogo de taxas da feira (para UI escolher)
        taxes: fair.taxes.map((t) => ({
          id: t.id,
          name: t.name,
          percentBps: t.percentBps,
          isActive: t.isActive,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),

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
                updatedAt:
                  fair.contractSettings.template.updatedAt.toISOString(),
              },
            }
          : null,

        createdAt: fair.createdAt.toISOString(),
        updatedAt: fair.updatedAt.toISOString(),
      },

      items,
    };
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
      const purchaseId = dto.purchaseId;

      const purchase = await tx.ownerFairPurchase.findUnique({
        where: { id: purchaseId },
        include: {
          ownerFair: { select: { id: true, ownerId: true, fairId: true } },
          installments: { orderBy: { number: 'asc' } },
        },
      });

      if (!purchase)
        throw new NotFoundException(
          'Compra (OwnerFairPurchase) não encontrada.',
        );

      // ✅ segurança de consistência (evita "contratos implícitos")
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

      // valida números existentes
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

      // snapshot para auditoria (antes)
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

      // ✅ recarrega parcelas e recalcula financeiros da compra
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

      // ✅ NOVO: se ficou 100% pago, recomputa status do OwnerFair (pendências -> concluído)
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
        // ✅ NOVO (útil pro front): status do expositor pode mudar automaticamente
        ownerFairStatus: ownerFairStatusInfo?.status ?? null,
        ownerFairStatusInfo,
      };
    });
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
        include: {
          stallFairs: true,
          contract: true,
          ownerFairPurchases: {
            include: { installments: true },
          },
        },
      });

      if (!before) {
        throw new NotFoundException(
          'Vínculo do expositor com a feira não encontrado.',
        );
      }

      const requestedStatus = dto.status;

      /**
       * =========================
       * 1) Calcula sinais do domínio
       * =========================
       * Observação:
       * - Aqui a gente não impõe uma “ordem fixa”.
       * - Só usa para validar se o status pedido faz sentido
       *   e, no caso de CONCLUIDO, garantir que tudo está ok.
       */
      const purchases = before.ownerFairPurchases ?? [];
      const purchasedQty = purchases.reduce((acc, p) => acc + (p.qty ?? 0), 0);
      const linkedQty = before.stallFairs?.length ?? 0;

      const totalCents = purchases.reduce(
        (acc, p) => acc + (p.totalCents ?? 0),
        0,
      );
      const paidCents = purchases.reduce(
        (acc, p) => acc + (p.paidCents ?? 0),
        0,
      );
      const remainingCents = Math.max(0, totalCents - paidCents);

      const openInstallmentsCount = purchases.reduce((acc, p) => {
        const open = (p.installments ?? []).filter((i) => !i.paidAt).length;
        return acc + open;
      }, 0);

      const isFullyPaid = remainingCents === 0 && openInstallmentsCount === 0;
      const isSigned = Boolean(
        before.contractSignedAt || before.contract?.signedAt,
      );

      const hasPurchases = purchasedQty > 0;
      const stallsAreComplete = hasPurchases && linkedQty >= purchasedQty;

      /**
       * Helper: define status “coerente” com base no estado real.
       * Responsabilidade:
       * - Se alguém pede um status que não faz sentido, usamos esse fallback
       *   para escolher um status aplicável e explicável.
       */
      const computeFallbackStatus = () => {
        if (!isFullyPaid) return OwnerFairStatus.AGUARDANDO_PAGAMENTO;
        if (!isSigned) return OwnerFairStatus.AGUARDANDO_ASSINATURA;
        if (!hasPurchases || !stallsAreComplete)
          return OwnerFairStatus.AGUARDANDO_BARRACAS;
        return OwnerFairStatus.CONCLUIDO;
      };

      /**
       * =========================
       * 2) Valida se o status solicitado é aplicável
       * =========================
       * Regra que você definiu:
       * - Não existe ordem fixa.
       * - Para mudar para um status intermediário, basta "fazer sentido" estar nele.
       * - Só CONCLUIDO exige tudo OK.
       */
      const missing: string[] = [];
      const notes: string[] = [];

      let effectiveStatus: OwnerFairStatus = requestedStatus;

      // ✅ CONCLUIDO: exige tudo OK
      if (requestedStatus === OwnerFairStatus.CONCLUIDO) {
        if (!isFullyPaid) {
          missing.push(
            `Pagamento pendente: faltam ${remainingCents} centavos (total=${totalCents}, pago=${paidCents}).`,
          );
          if (openInstallmentsCount > 0) {
            missing.push(
              `Existem ${openInstallmentsCount} parcela(s) em aberto.`,
            );
          }
        }

        if (!isSigned) {
          missing.push('Contrato ainda não foi assinado.');
        }

        if (!hasPurchases) {
          missing.push(
            'Nenhuma compra de barraca registrada para este expositor.',
          );
        }

        if (hasPurchases && !stallsAreComplete) {
          missing.push(
            `Barracas pendentes: vinculadas=${linkedQty}, compradas=${purchasedQty}.`,
          );
        }

        if (missing.length > 0) {
          // Não pode concluir -> cai no status coerente do momento
          effectiveStatus = computeFallbackStatus();
          notes.push(
            `Não foi possível concluir. Status ajustado para (${effectiveStatus}) com base nas pendências.`,
          );
        } else {
          notes.push('Concluído: pagamento, assinatura e barracas estão OK.');
        }
      }

      // ✅ AGUARDANDO_PAGAMENTO: só faz sentido se NÃO estiver 100% pago
      if (requestedStatus === OwnerFairStatus.AGUARDANDO_PAGAMENTO) {
        if (isFullyPaid) {
          effectiveStatus = computeFallbackStatus();
          missing.push('O pagamento já está 100% quitado.');
          notes.push(
            `Status solicitado (${requestedStatus}) não faz sentido agora. Status ajustado para (${effectiveStatus}).`,
          );
        } else {
          notes.push('Status aplicado: ainda existe pendência de pagamento.');
        }
      }

      // ✅ AGUARDANDO_ASSINATURA: só faz sentido se NÃO estiver assinado
      if (requestedStatus === OwnerFairStatus.AGUARDANDO_ASSINATURA) {
        if (isSigned) {
          effectiveStatus = computeFallbackStatus();
          missing.push('O contrato já está assinado.');
          notes.push(
            `Status solicitado (${requestedStatus}) não faz sentido agora. Status ajustado para (${effectiveStatus}).`,
          );
        } else {
          notes.push('Status aplicado: assinatura pendente.');
        }
      }

      // ✅ AGUARDANDO_BARRACAS: faz sentido se:
      // - existe compra e não completou vínculo
      // - OU não existe compra ainda (pendência operacional)
      if (requestedStatus === OwnerFairStatus.AGUARDANDO_BARRACAS) {
        if (hasPurchases && stallsAreComplete) {
          effectiveStatus = computeFallbackStatus();
          missing.push(
            'As barracas já estão todas vinculadas para o total comprado.',
          );
          notes.push(
            `Status solicitado (${requestedStatus}) não faz sentido agora. Status ajustado para (${effectiveStatus}).`,
          );
        } else {
          // Aqui você explicitou: pode colocar "aguardando barracas" mesmo sem pagar/assinar.
          notes.push(
            'Status aplicado: pendência de vínculo de barracas (ou compras ainda não definidas).',
          );
        }
      }

      // ✅ SELECIONADO: sempre aplicável (não valida nada)
      if (requestedStatus === OwnerFairStatus.SELECIONADO) {
        notes.push('Status aplicado: selecionado.');
      }

      /**
       * Segurança final: se por algum motivo o effectiveStatus ficou undefined,
       * usa fallback coerente.
       */
      if (!effectiveStatus) {
        effectiveStatus = computeFallbackStatus();
        notes.push(
          `Status ajustado automaticamente para (${effectiveStatus}).`,
        );
      }

      /**
       * =========================
       * 3) Persistência + auditoria
       * =========================
       * Se não mudou nada, não escreve no banco.
       */
      if (before.status === effectiveStatus) {
        return {
          ownerFair: before,
          info: {
            requestedStatus,
            appliedStatus: effectiveStatus,
            missing,
            notes,
          },
        };
      }

      const after = await tx.ownerFair.update({
        where: { ownerId_fairId: { ownerId, fairId } },
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
          requestedStatus,
          appliedStatus: effectiveStatus,
          missing,
          notes,

          // sinais (úteis no log/auditoria)
          purchasedQty,
          linkedQty,
          totalCents,
          paidCents,
          remainingCents,
          openInstallmentsCount,
          isFullyPaid,
          isSigned,
          hasPurchases,
          stallsAreComplete,
        },
      });

      return {
        ownerFair: after,
        info: {
          requestedStatus,
          appliedStatus: effectiveStatus,
          missing,
          notes,
        },
      };
    });
  }

  /**
   * Recalcula e, se necessário, atualiza o status do OwnerFair com base no estado real.
   * Regra (primeiro gargalo):
   * - Se não está 100% pago => AGUARDANDO_PAGAMENTO
   * - Senão se não assinou => AGUARDANDO_ASSINATURA
   * - Senão se barracas incompletas (ou sem compras) => AGUARDANDO_BARRACAS
   * - Senão => CONCLUIDO
   *
   * Observação:
   * - Este helper não depende do "status solicitado". Ele impõe consistência do domínio.
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

    // Se não mudou, não faz update nem auditoria
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
   * Helper para decidir se vale recomputar status.
   * Você pediu: "se estiver tudo pago, verifica pendências e conclui se der".
   *
   * Então aqui só recomputamos se o expositor tiver totalCents > 0 e ficou 100% pago,
   * ou se você quiser ser mais agressivo e recomputar sempre, basta retornar true.
   */
  private shouldRecomputeOwnerFairAfterPurchaseUpdate(args: {
    totalCents: number;
    paidCents: number;
  }) {
    // Se não existe valor a pagar, não força mudanças automáticas
    if ((args.totalCents ?? 0) <= 0) return false;

    return (args.paidCents ?? 0) >= (args.totalCents ?? 0);
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
      });

      if (!purchase) throw new NotFoundException('Compra não encontrada.');
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

      // ✅ Recalcula compra (status pode sair de OVERDUE)
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

      // ✅ NOVO: se ficou 100% pago, recomputa status do OwnerFair (pendências -> concluído)
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
        // ✅ NOVO
        ownerFairStatus: ownerFairStatusInfo?.status ?? null,
        ownerFairStatusInfo,
      };
    });
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
      });

      if (!purchase) throw new NotFoundException('Compra não encontrada.');
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

      // ✅ cria pagamento no histórico
      const payment = await tx.ownerFairPurchaseInstallmentPayment.create({
        data: {
          installmentId: installment.id,
          paidAt: this.parseDateOnlyToUTC(dto.paidAt),
          amountCents: dto.amountCents,
          note: dto.note ?? null,
          createdByUserId: actorUserId,
        },
      });

      // ✅ recarrega pagamentos da parcela para recalcular cache
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

      // ✅ recalcula compra (paidCents/status/paidAt)
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

      // ✅ NOVO: se ficou 100% pago, recomputa status do OwnerFair (pendências -> concluído)
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
        // ✅ NOVO
        ownerFairStatus: ownerFairStatusInfo?.status ?? null,
        ownerFairStatusInfo,
      };
    });
  }

  /**
   * Atualiza o campo de observações do OwnerFair (vínculo expositor ↔ feira).
   * Por decisão de UX, a API recebe (fairId, ownerId) e resolve o OwnerFair internamente.
   */
  async updateExhibitorObservations(params: {
    fairId: string;
    ownerId: string;
    observations: string | null;
    actorUserId: string;
  }) {
    const { fairId, ownerId, observations, actorUserId } = params;

    // Regra simples: normaliza string vazia para null (evita salvar lixo e facilita filtro depois)
    const normalized =
      observations && observations.trim().length > 0
        ? observations.trim()
        : null;

    const ownerFair = await this.prisma.ownerFair.findUnique({
      where: {
        ownerId_fairId: { ownerId, fairId },
      },
    });

    if (!ownerFair) {
      throw new NotFoundException(
        'Vínculo do expositor com a feira não encontrado.',
      );
    }

    // Atualiza e registra auditoria em transação para manter consistência.
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ownerFair.update({
        where: { id: ownerFair.id },
        data: { observations: normalized },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entity: AuditEntity.OWNER_FAIR,
          entityId: ownerFair.id,
          actorUserId,
          before: { observations: ownerFair.observations },
          after: { observations: updated.observations },
          meta: { fairId, ownerId },
        },
      });

      return updated;
    });

    return result;
  }
}
