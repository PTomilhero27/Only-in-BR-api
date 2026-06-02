import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  InventoryMovementType,
  InventoryReservationStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from 'src/common/audit/audit.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateInventoryReservationDto } from './dto/create-inventory-reservation.dto';
import { ListInventoryReservationsDto } from './dto/list-inventory-reservations.dto';
import { ApproveInventoryReservationDto } from './dto/approve-inventory-reservation.dto';
import { PickupInventoryReservationDto } from './dto/pickup-inventory-reservation.dto';
import { ReturnInventoryReservationDto } from './dto/return-inventory-reservation.dto';
import { CancelInventoryReservationDto } from './dto/cancel-inventory-reservation.dto';

/**
 * Service do ciclo de vida das reservas.
 * Responsabilidade:
 * - Criar lotes de itens para feira ou finalidade avulsa.
 * - Validar disponibilidade na aprovacao e retirada.
 * - Orquestrar baixas, devolucoes e perdas sem duplicar regra de quantity.
 */
@Injectable()
export class InventoryReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  /** Lista reservas com filtros de evento, status, solicitante, texto e data prevista. */
  async list(query: ListInventoryReservationsDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: any = {};

    if (query.fairId) where.fairId = query.fairId;
    if (query.status) where.status = query.status;
    if (query.requesterUserId) where.requesterUserId = query.requesterUserId;
    if (query.search) {
      where.OR = [
        { purpose: { contains: query.search, mode: 'insensitive' } },
        { responsibleName: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.expectedPickupFrom || query.expectedPickupTo) {
      where.expectedPickupAt = {};
      if (query.expectedPickupFrom) where.expectedPickupAt.gte = new Date(query.expectedPickupFrom);
      if (query.expectedPickupTo) where.expectedPickupAt.lte = new Date(query.expectedPickupTo);
    }

    const [rows, total] = await Promise.all([
      this.prisma.inventoryReservation.findMany({
        where,
        include: { fair: { select: { name: true } }, items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.inventoryReservation.count({ where }),
    ]);

    return { items: rows.map((r) => this.toReservationResponse(r)), meta: { page, perPage, total } };
  }

  /** Cria reserva PENDING sem alterar estoque nem criar movimentacao. */
  async create(dto: CreateInventoryReservationDto, actorUserId: string) {
    if (!dto.fairId && !dto.purpose?.trim()) {
      throw new BadRequestException('Reservas sem feira precisam informar uma finalidade.');
    }
    this.ensureNoDuplicateItems(dto.items.map((i) => i.itemId));

    return this.prisma.$transaction(async (tx) => {
      if (dto.fairId) await this.ensureFairExists(tx, dto.fairId);
      await this.ensureItemsExist(tx, dto.items.map((i) => i.itemId));

      const reservation = await tx.inventoryReservation.create({
        data: {
          fairId: dto.fairId,
          purpose: dto.purpose,
          requesterUserId: actorUserId,
          responsibleName: dto.responsibleName,
          expectedPickupAt: dto.expectedPickupAt ? new Date(dto.expectedPickupAt) : null,
          notes: dto.notes,
          items: {
            create: dto.items.map((item) => ({
              itemId: item.itemId,
              requestedQty: item.requestedQty,
              notes: item.notes,
            })),
          },
        },
        include: this.detailInclude(),
      });

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.INVENTORY_RESERVATION,
        entityId: reservation.id,
        actorUserId,
        after: reservation,
      });

      return this.toReservationDetails(reservation);
    });
  }

  /** Detalha reserva com itens, feira/finalidade e historico de movimentos. */
  async findOne(id: string) {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id },
      include: this.detailInclude(),
    });
    if (!reservation) throw new NotFoundException('Reserva de estoque nao encontrada.');
    return this.toReservationDetails(reservation);
  }

  /** Aprova reserva, permitindo quantidades menores e bloqueando disponibilidade futura. */
  async approve(id: string, dto: ApproveInventoryReservationDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.getReservationOrFail(tx, id);
      if (before.status !== InventoryReservationStatus.PENDING) {
        throw new BadRequestException('Apenas reservas pendentes podem ser aprovadas.');
      }
      this.ensureNoDuplicateItems((dto.items ?? []).map((i) => i.itemId));
      const approvals = new Map((dto.items ?? []).map((i) => [i.itemId, i.approvedQty]));
      const requested = before.items.map((ri) => ({
        itemId: ri.itemId,
        qty: approvals.get(ri.itemId) ?? ri.requestedQty,
      }));

      const availability = await this.inventory.checkAvailability(requested, tx);
      const unavailable = availability.filter((i) => !i.isAvailable);
      if (unavailable.length) {
        throw new BadRequestException({
          message: 'Alguns itens nao possuem disponibilidade suficiente.',
          items: unavailable.map((i) => ({
            itemId: i.itemId,
            name: i.name,
            requestedQty: i.requestedQty,
            availableQty: i.availableQty,
          })),
        });
      }

      for (const ri of before.items) {
        const approvedQty = approvals.get(ri.itemId) ?? ri.requestedQty;
        if (approvedQty > ri.requestedQty) {
          throw new BadRequestException('Quantidade aprovada nao pode exceder a solicitada.');
        }
        await tx.inventoryReservationItem.update({
          where: { reservationId_itemId: { reservationId: id, itemId: ri.itemId } },
          data: { approvedQty },
        });
      }

      const after = await tx.inventoryReservation.update({
        where: { id },
        data: { status: InventoryReservationStatus.APPROVED, notes: dto.notes ?? before.notes },
        include: this.detailInclude(),
      });
      await this.auditReservation(tx, actorUserId, id, before, after, 'APPROVE');
      return this.toReservationDetails(after);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Marca reserva aprovada como em separacao. */
  async markSeparating(id: string, actorUserId: string) {
    return this.changeStatus(id, actorUserId, [InventoryReservationStatus.APPROVED], InventoryReservationStatus.SEPARATING, 'SEPARATING');
  }

  /** Marca reserva em separacao como pronta para retirada. */
  async markReady(id: string, actorUserId: string) {
    return this.changeStatus(id, actorUserId, [InventoryReservationStatus.SEPARATING], InventoryReservationStatus.READY_FOR_PICKUP, 'READY');
  }

  /** Baixa estoque na retirada e cria uma movimentacao OUT para cada item retirado. */
  async pickup(id: string, dto: PickupInventoryReservationDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.getReservationOrFail(tx, id);
      if (![InventoryReservationStatus.APPROVED, InventoryReservationStatus.SEPARATING, InventoryReservationStatus.READY_FOR_PICKUP].includes(before.status)) {
        throw new BadRequestException('Apenas reservas aprovadas, em separacao ou prontas podem ser retiradas.');
      }
      this.ensureNoDuplicateItems((dto.items ?? []).map((i) => i.itemId));
      const pickedMap = new Map((dto.items ?? []).map((i) => [i.itemId, i.pickedQty]));

      for (const ri of before.items) {
        const approvedQty = ri.approvedQty ?? ri.requestedQty;
        const pickedQty = pickedMap.get(ri.itemId) ?? approvedQty;
        if (pickedQty > approvedQty) throw new BadRequestException('Quantidade retirada nao pode exceder a aprovada.');
        if (pickedQty <= 0) continue;

        await tx.inventoryReservationItem.update({
          where: { reservationId_itemId: { reservationId: id, itemId: ri.itemId } },
          data: { pickedQty },
        });
        await this.inventory.createMovementAndUpdateQuantity(tx, {
          itemId: ri.itemId,
          reservationId: id,
          type: InventoryMovementType.OUT,
          quantity: pickedQty,
          fairId: before.fairId,
          purpose: before.purpose,
          notes: dto.notes ?? 'Retirada de reserva de estoque.',
          createdById: actorUserId,
        });
      }

      const after = await tx.inventoryReservation.update({
        where: { id },
        data: { status: InventoryReservationStatus.PICKED_UP, pickedUpAt: new Date() },
        include: this.detailInclude(),
      });
      await this.auditReservation(tx, actorUserId, id, before, after, 'PICKUP');
      return this.toReservationDetails(after);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Registra retorno, perdas, consumo e danos, atualizando status conforme pendencias. */
  async returnItems(id: string, dto: ReturnInventoryReservationDto, actorUserId: string) {
    this.ensureNoDuplicateItems(dto.items.map((i) => i.itemId));
    return this.prisma.$transaction(async (tx) => {
      const before = await this.getReservationOrFail(tx, id);
      if (![InventoryReservationStatus.PICKED_UP, InventoryReservationStatus.PARTIALLY_RETURNED].includes(before.status)) {
        throw new BadRequestException('Apenas reservas retiradas podem receber devolucao.');
      }

      for (const input of dto.items) {
        const ri = before.items.find((item) => item.itemId === input.itemId);
        if (!ri) throw new BadRequestException('Item informado nao pertence a reserva.');

        const returnedQty = input.returnedQty ?? 0;
        const lostQty = input.lostQty ?? 0;
        const damagedQty = input.damagedQty ?? 0;
        const consumedQty = input.consumedQty ?? 0;
        const currentResolved = (ri.returnedQty ?? 0) + (ri.lostQty ?? 0) + (ri.damagedQty ?? 0) + (ri.consumedQty ?? 0);
        const newResolved = currentResolved + returnedQty + lostQty + damagedQty + consumedQty;
        const pickedQty = ri.pickedQty ?? 0;
        if (newResolved > pickedQty && !(input.notes?.trim() || dto.notes?.trim())) {
          throw new BadRequestException('Divergencia na devolucao exige observacao explicativa.');
        }

        await tx.inventoryReservationItem.update({
          where: { reservationId_itemId: { reservationId: id, itemId: input.itemId } },
          data: {
            returnedQty: (ri.returnedQty ?? 0) + returnedQty,
            lostQty: (ri.lostQty ?? 0) + lostQty,
            damagedQty: (ri.damagedQty ?? 0) + damagedQty,
            consumedQty: (ri.consumedQty ?? 0) + consumedQty,
            notes: input.notes ?? ri.notes,
          },
        });

        if (returnedQty > 0) {
          await this.inventory.createMovementAndUpdateQuantity(tx, {
            itemId: input.itemId,
            reservationId: id,
            type: InventoryMovementType.RETURN,
            quantity: returnedQty,
            fairId: before.fairId,
            purpose: before.purpose,
            notes: input.notes ?? dto.notes ?? 'Devolucao de reserva.',
            createdById: actorUserId,
          });
        }
        if (lostQty + consumedQty > 0) {
          await this.inventory.createMovementAndUpdateQuantity(tx, {
            itemId: input.itemId,
            reservationId: id,
            type: InventoryMovementType.LOSS,
            quantity: lostQty + consumedQty,
            fairId: before.fairId,
            purpose: before.purpose,
            notes: input.notes ?? dto.notes ?? 'Perda ou consumo na devolucao.',
            createdById: actorUserId,
          });
        }
        if (damagedQty > 0) {
          await this.inventory.createMovementAndUpdateQuantity(tx, {
            itemId: input.itemId,
            reservationId: id,
            type: InventoryMovementType.DAMAGE,
            quantity: damagedQty,
            fairId: before.fairId,
            purpose: before.purpose,
            notes: input.notes ?? dto.notes ?? 'Dano registrado na devolucao.',
            createdById: actorUserId,
            affectsStock: false,
          });
        }
      }

      const refreshed = await this.getReservationOrFail(tx, id);
      const allResolved = refreshed.items.every((ri) => {
        const picked = ri.pickedQty ?? 0;
        const resolved = (ri.returnedQty ?? 0) + (ri.lostQty ?? 0) + (ri.damagedQty ?? 0) + (ri.consumedQty ?? 0);
        return resolved >= picked;
      });

      const after = await tx.inventoryReservation.update({
        where: { id },
        data: {
          status: allResolved ? InventoryReservationStatus.RETURNED : InventoryReservationStatus.PARTIALLY_RETURNED,
          returnedAt: allResolved ? new Date() : null,
          notes: dto.notes ?? refreshed.notes,
        },
        include: this.detailInclude(),
      });
      await this.auditReservation(tx, actorUserId, id, before, after, 'RETURN');
      return this.toReservationDetails(after);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Cancela reservas que ainda nao tiveram retirada, liberando disponibilidade bloqueada. */
  async cancel(id: string, dto: CancelInventoryReservationDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.getReservationOrFail(tx, id);
      if (![InventoryReservationStatus.PENDING, InventoryReservationStatus.APPROVED, InventoryReservationStatus.SEPARATING, InventoryReservationStatus.READY_FOR_PICKUP].includes(before.status)) {
        throw new BadRequestException('Reserva retirada nao pode ser cancelada diretamente. Registre devolucao, perda ou dano.');
      }
      const after = await tx.inventoryReservation.update({
        where: { id },
        data: { status: InventoryReservationStatus.CANCELLED, notes: dto.notes ?? before.notes },
        include: this.detailInclude(),
      });
      await this.auditReservation(tx, actorUserId, id, before, after, 'CANCEL');
      return this.toReservationDetails(after);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async changeStatus(id: string, actorUserId: string, from: InventoryReservationStatus[], to: InventoryReservationStatus, action: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.getReservationOrFail(tx, id);
      if (!from.includes(before.status)) {
        throw new BadRequestException(`Reserva em status ${before.status} nao pode ir para ${to}.`);
      }
      const after = await tx.inventoryReservation.update({
        where: { id },
        data: { status: to },
        include: this.detailInclude(),
      });
      await this.auditReservation(tx, actorUserId, id, before, after, action);
      return this.toReservationDetails(after);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async getReservationOrFail(tx: any, id: string) {
    const reservation = await tx.inventoryReservation.findUnique({ where: { id }, include: this.detailInclude() });
    if (!reservation) throw new NotFoundException('Reserva de estoque nao encontrada.');
    return reservation;
  }

  private async ensureFairExists(tx: any, fairId: string) {
    const fair = await tx.fair.findUnique({ where: { id: fairId }, select: { id: true } });
    if (!fair) throw new NotFoundException('Feira informada na reserva nao foi encontrada.');
  }

  private async ensureItemsExist(tx: any, itemIds: string[]) {
    const count = await tx.inventoryItem.count({ where: { id: { in: itemIds } } });
    if (count !== itemIds.length) throw new BadRequestException('Um ou mais itens da reserva nao foram encontrados.');
  }

  private ensureNoDuplicateItems(itemIds: string[]) {
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException('Nao e permitido repetir o mesmo item na reserva.');
    }
  }

  private async auditReservation(tx: any, actorUserId: string, id: string, before: unknown, after: unknown, action: string) {
    await this.audit.log(tx, {
      action: AuditAction.UPDATE,
      entity: AuditEntity.INVENTORY_RESERVATION,
      entityId: id,
      actorUserId,
      before,
      after,
      meta: { action },
    });
  }

  private detailInclude() {
    return {
      fair: { select: { name: true } },
      items: { include: { item: true }, orderBy: { createdAt: 'asc' } },
      movements: { include: { item: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
    } as const;
  }

  private toReservationResponse(r: any) {
    const items = r.items ?? [];
    return {
      id: r.id,
      fairId: r.fairId,
      fairName: r.fair?.name ?? null,
      purpose: r.purpose,
      requesterUserId: r.requesterUserId,
      responsibleName: r.responsibleName,
      status: r.status,
      expectedPickupAt: r.expectedPickupAt?.toISOString?.() ?? r.expectedPickupAt,
      pickedUpAt: r.pickedUpAt?.toISOString?.() ?? r.pickedUpAt,
      returnedAt: r.returnedAt?.toISOString?.() ?? r.returnedAt,
      itemsCount: items.length,
      requestedTotal: items.reduce((acc: number, item: any) => acc + item.requestedQty, 0),
      createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
    };
  }

  private toReservationDetails(r: any) {
    return {
      ...this.toReservationResponse(r),
      notes: r.notes,
      items: (r.items ?? []).map((ri: any) => ({
        id: ri.id,
        itemId: ri.itemId,
        name: ri.item?.name,
        unit: ri.item?.unit,
        requestedQty: ri.requestedQty,
        approvedQty: ri.approvedQty,
        pickedQty: ri.pickedQty,
        returnedQty: ri.returnedQty,
        lostQty: ri.lostQty,
        damagedQty: ri.damagedQty,
        consumedQty: ri.consumedQty,
        notes: ri.notes,
      })),
      movements: (r.movements ?? []).map((m: any) => ({
        id: m.id,
        itemId: m.itemId,
        itemName: m.item?.name,
        type: m.type,
        quantity: m.quantity,
        notes: m.notes,
        createdById: m.createdById,
        createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
      })),
    };
  }
}
