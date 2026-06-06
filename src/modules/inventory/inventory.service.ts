import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  InventoryItemStatus,
  InventoryMovementType,
  InventoryReservationStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from 'src/common/audit/audit.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { ListInventoryItemsDto } from './dto/list-inventory-items.dto';
import { CreateInventoryCategoryDto } from './dto/create-category.dto';
import {
  CheckInventoryAvailabilityItemDto,
} from './dto/availability.dto';
import { CreateInventoryMovementDto } from '../inventory-movements/dto/create-inventory-movement.dto';

/**
 * Service central do estoque.
 * Responsabilidade:
 * - CRUD dos itens.
 * - Calculo de disponibilidade considerando reservas bloqueantes.
 * - Movimentacoes que alteram quantity.
 * - Recalculo de status automatico apos alteracoes de quantidade.
 */
@Injectable()
export class InventoryService {
  private readonly blockingReservationStatuses = [
    InventoryReservationStatus.APPROVED,
    InventoryReservationStatus.SEPARATING,
    InventoryReservationStatus.READY_FOR_PICKUP,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Cria um item cadastral de estoque.
   * A quantidade inicial e aceita para importacao da planilha e implantacao do modulo.
   */
  async create(dto: CreateInventoryItemDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const quantity = dto.quantity ?? 0;
      const minQuantity = dto.minQuantity ?? 0;
      const manualStatus = dto.status;
      const status =
        manualStatus === InventoryItemStatus.INACTIVE ||
        manualStatus === InventoryItemStatus.DAMAGED
          ? manualStatus
          : this.computeAutomaticStatus(quantity, minQuantity);

      const item = await tx.inventoryItem.create({
        data: {
          name: dto.name,
          category: dto.category,
          unit: dto.unit ?? 'UN',
          imageUrl: dto.imageUrl,
          location: dto.location,
          quantity,
          minQuantity,
          status,
          notes: dto.notes,
          categories: dto.categoryIds ? {
            connect: dto.categoryIds.map(id => ({ id }))
          } : undefined,
        },
        include: {
          categories: true
        }
      });

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.INVENTORY_ITEM,
        entityId: item.id,
        actorUserId,
        after: item,
      });

      return this.toItemResponse(item);
    });
  }

  /**
   * Lista itens com filtros administrativos e paginacao segura.
   */
  async list(query: ListInventoryItemsDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: any = {};

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.category) {
      where.categories = {
        some: {
          OR: [
            { id: query.category },
            { name: { contains: query.category, mode: 'insensitive' } }
          ]
        }
      };
    }
    if (query.status) where.status = query.status;

    if (query.lowStock) {
      const all = await this.prisma.inventoryItem.findMany({
        where,
        include: { categories: true },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      });
      const filtered = all.filter((item) => item.quantity <= item.minQuantity);
      const items = filtered.slice((page - 1) * perPage, page * perPage);
      return { items: items.map((i) => this.toItemResponse(i)), meta: { page, perPage, total: filtered.length } };
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        include: { categories: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return { items: items.map((i) => this.toItemResponse(i)), meta: { page, perPage, total } };
  }

  /**
   * Detalha um item, incluindo reservas abertas e ultimas movimentacoes.
   */
  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        categories: true,
        movements: { orderBy: { createdAt: 'desc' }, take: 10 },
        reservationItems: {
          where: { reservation: { status: { in: this.blockingReservationStatuses } } },
          include: { reservation: { include: { fair: { select: { name: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!item) throw new NotFoundException('Item de estoque nao encontrado.');

    const reservedQty = await this.getReservedQty(id);
    return {
      ...this.toItemResponse(item),
      reservedQty,
      availableQty: item.quantity - reservedQty,
      openReservations: item.reservationItems.map((ri) => ({
        reservationId: ri.reservationId,
        status: ri.reservation.status,
        fairId: ri.reservation.fairId,
        fairName: ri.reservation.fair?.name ?? null,
        purpose: ri.reservation.purpose,
        approvedQty: ri.approvedQty ?? ri.requestedQty,
      })),
      recentMovements: item.movements.map((m) => this.toMovementSummary(m)),
    };
  }

  /**
   * Atualiza dados cadastrais do item.
   * Se quantity/minQuantity mudarem, recalcula status automatico salvo quando aplicavel.
   */
  async update(id: string, dto: UpdateInventoryItemDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.inventoryItem.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Item de estoque nao encontrado.');

      const quantity = dto.quantity ?? before.quantity;
      if (quantity < 0) throw new BadRequestException('A quantidade do item nao pode ficar negativa.');

      const minQuantity = dto.minQuantity ?? before.minQuantity;
      const manualStatus = dto.status;
      const status =
        manualStatus === InventoryItemStatus.INACTIVE || manualStatus === InventoryItemStatus.DAMAGED
          ? manualStatus
          : before.status === InventoryItemStatus.INACTIVE || before.status === InventoryItemStatus.DAMAGED
            ? before.status
            : this.computeAutomaticStatus(quantity, minQuantity);

      const after = await tx.inventoryItem.update({
        where: { id },
        data: {
          name: dto.name,
          category: dto.category,
          unit: dto.unit,
          imageUrl: dto.imageUrl,
          location: dto.location,
          quantity,
          minQuantity,
          status,
          notes: dto.notes,
          categories: dto.categoryIds ? {
            set: dto.categoryIds.map(id => ({ id }))
          } : undefined,
        },
        include: {
          categories: true
        }
      });

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.INVENTORY_ITEM,
        entityId: id,
        actorUserId,
        before,
        after,
      });

      return this.toItemResponse(after);
    });
  }

  /**
   * Inativa item em vez de excluir fisicamente, preservando historico.
   */
  async softDelete(id: string, actorUserId: string) {
    return this.update(id, { status: InventoryItemStatus.INACTIVE }, actorUserId);
  }

  /**
   * Registra entrada, ajuste ou dano manual.
   * Movimentacoes de reserva usam este mesmo helper interno para manter regra unica de quantity.
   */
  async createManualMovement(itemId: string, dto: CreateInventoryMovementDto, actorUserId: string) {
    if (!dto.notes?.trim()) {
      throw new BadRequestException('Observacoes sao obrigatorias para movimentacoes manuais.');
    }
    const allowedManualTypes: InventoryMovementType[] = [
      InventoryMovementType.IN,
      InventoryMovementType.OUT,
      InventoryMovementType.ADJUSTMENT,
      InventoryMovementType.DAMAGE,
    ];
    if (!allowedManualTypes.includes(dto.type)) {
      throw new BadRequestException('Movimentacao manual permite apenas IN, OUT, ADJUSTMENT ou DAMAGE.');
    }
    if (dto.type !== InventoryMovementType.ADJUSTMENT && dto.quantity <= 0) {
      throw new BadRequestException('Entrada, saída e dano manual exigem quantidade maior que zero.');
    }

    return this.prisma.$transaction(async (tx) => {
      const movement = await this.createMovementAndUpdateQuantity(tx, {
        itemId,
        type: dto.type,
        quantity: dto.quantity,
        fairId: dto.fairId,
        purpose: dto.purpose,
        notes: dto.notes,
        createdById: actorUserId,
        requiresReturn: dto.requiresReturn ?? false,
        responsibleName: dto.responsibleName,
      });

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.INVENTORY_MOVEMENT,
        entityId: movement.id,
        actorUserId,
        after: movement,
        meta: { manual: true },
      });

      return this.toMovementSummary(movement);
    });
  }

  async returnManualMovement(movementId: string, quantity: number, actorUserId: string, finalize?: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.findUnique({
        where: { id: movementId },
        include: { item: true }
      });
      if (!movement) throw new NotFoundException('Movimentacao nao encontrada.');
      if (!movement.requiresReturn) {
        throw new BadRequestException('Esta movimentacao nao foi marcada para devolucao.');
      }
      if (quantity <= 0) {
        throw new BadRequestException('A quantidade devolvida deve ser maior que zero.');
      }

      const newReturnedQty = movement.returnedQty + quantity;
      const shouldFinalize = finalize || newReturnedQty >= movement.quantity;

      const updatedMovement = await tx.inventoryMovement.update({
        where: { id: movementId },
        data: {
          returnedQty: newReturnedQty,
          requiresReturn: shouldFinalize ? false : movement.requiresReturn
        }
      });

      const returnMovement = await this.createMovementAndUpdateQuantity(tx, {
        itemId: movement.itemId,
        type: InventoryMovementType.RETURN,
        quantity,
        notes: `Devolucao referente a saida manual #${movementId.slice(0, 8)}.`,
        createdById: actorUserId,
      });

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.INVENTORY_MOVEMENT,
        entityId: movementId,
        actorUserId,
        after: updatedMovement,
        meta: { manualReturn: true, returnMovementId: returnMovement.id }
      });

      return this.toMovementSummary(updatedMovement);
    });
  }

  /**
   * Checa disponibilidade para varios itens.
   * Retorna tambem itens inexistentes como indisponiveis para erro claro no frontend.
   */
  async checkAvailability(items: CheckInventoryAvailabilityItemDto[], tx: any = this.prisma) {
    return Promise.all(
      items.map(async (input) => {
        const item = await tx.inventoryItem.findUnique({ where: { id: input.itemId } });
        if (!item) {
          return {
            itemId: input.itemId,
            name: 'Item nao encontrado',
            requestedQty: input.qty,
            currentQty: 0,
            reservedQty: 0,
            availableQty: 0,
            isAvailable: false,
          };
        }

        const reservedQty = await this.getReservedQty(input.itemId, tx);
        const availableQty = item.quantity - reservedQty;
        return {
          itemId: item.id,
          name: item.name,
          requestedQty: input.qty,
          currentQty: item.quantity,
          reservedQty,
          availableQty,
          isAvailable: availableQty >= input.qty && item.status !== InventoryItemStatus.INACTIVE,
        };
      }),
    );
  }

  /**
   * Helper reutilizavel para criar movimento e aplicar impacto em quantity.
   * OUT, DAMAGE e ADJUSTMENT negativo diminuem; IN, RETURN e ADJUSTMENT positivo aumentam.
   */
  async createMovementAndUpdateQuantity(
    tx: any,
    params: {
      itemId: string;
      type: InventoryMovementType;
      quantity: number;
      reservationId?: string | null;
      fairId?: string | null;
      purpose?: string | null;
      notes?: string | null;
      createdById?: string | null;
      affectsStock?: boolean;
      requiresReturn?: boolean;
      responsibleName?: string | null;
    },
  ) {
    const item = await tx.inventoryItem.findUnique({ where: { id: params.itemId } });
    if (!item) throw new NotFoundException('Item de estoque nao encontrado.');
    if (params.quantity === 0) throw new BadRequestException('Quantidade da movimentacao nao pode ser zero.');

    const delta = params.affectsStock === false ? 0 : this.getMovementDelta(params.type, params.quantity);
    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 0) {
      throw new BadRequestException(`Movimentacao invalida para "${item.name}". Estoque nao pode ficar negativo.`);
    }

    const movement = await tx.inventoryMovement.create({
      data: {
        itemId: params.itemId,
        reservationId: params.reservationId ?? null,
        type: params.type,
        quantity: Math.abs(params.quantity),
        fairId: params.fairId ?? null,
        purpose: params.purpose ?? null,
        notes: params.notes ?? null,
        createdById: params.createdById ?? null,
        requiresReturn: params.requiresReturn ?? false,
        returnedQty: 0,
        responsibleName: params.responsibleName ?? null,
      },
      include: { item: { select: { name: true } } },
    });

    await tx.inventoryItem.update({
      where: { id: params.itemId },
      data: { quantity: nextQuantity },
    });
    await this.recalculateItemStatus(params.itemId, tx);

    return movement;
  }

  /**
   * Soma as quantidades bloqueadas por reservas aprovadas/a separar/prontas.
   */
  async getReservedQty(itemId: string, tx: any = this.prisma) {
    const rows = await tx.inventoryReservationItem.findMany({
      where: {
        itemId,
        reservation: { status: { in: this.blockingReservationStatuses } },
      },
      select: { requestedQty: true, approvedQty: true },
    });
    return rows.reduce((acc, row) => acc + (row.approvedQty ?? row.requestedQty), 0);
  }

  /**
   * Recalcula status automatico sem sobrescrever itens manualmente inativos ou danificados.
   */
  async recalculateItemStatus(itemId: string, tx: any = this.prisma) {
    const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) return null;
    if (item.status === InventoryItemStatus.INACTIVE || item.status === InventoryItemStatus.DAMAGED) {
      return item;
    }
    return tx.inventoryItem.update({
      where: { id: itemId },
      data: { status: this.computeAutomaticStatus(item.quantity, item.minQuantity) },
    });
  }

  private computeAutomaticStatus(quantity: number, minQuantity: number) {
    if (quantity <= 0) return InventoryItemStatus.OUT_OF_STOCK;
    if (quantity <= minQuantity) return InventoryItemStatus.LOW_STOCK;
    return InventoryItemStatus.IN_STOCK;
  }

  private getMovementDelta(type: InventoryMovementType, quantity: number) {
    if (type === InventoryMovementType.IN || type === InventoryMovementType.RETURN) return Math.abs(quantity);
    if (type === InventoryMovementType.OUT || type === InventoryMovementType.DAMAGE) return -Math.abs(quantity);
    if (type === InventoryMovementType.LOSS) return 0;
    return quantity;
  }

  private toItemResponse(item: any) {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      categories: item.categories ? item.categories.map((c: any) => ({ id: c.id, name: c.name })) : [],
      unit: item.unit,
      imageUrl: item.imageUrl,
      location: item.location,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      status: item.status,
      notes: item.notes,
      createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
      updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
    };
  }

  private toMovementSummary(movement: any) {
    return {
      id: movement.id,
      itemId: movement.itemId,
      itemName: movement.item?.name,
      reservationId: movement.reservationId,
      type: movement.type,
      quantity: movement.quantity,
      fairId: movement.fairId,
      purpose: movement.purpose,
      notes: movement.notes,
      createdById: movement.createdById,
      responsibleName: movement.responsibleName,
      requiresReturn: movement.requiresReturn,
      returnedQty: movement.returnedQty,
      createdAt: movement.createdAt?.toISOString?.() ?? movement.createdAt,
    };
  }
  async listCategories() {
    return this.prisma.inventoryCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateInventoryCategoryDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const name = dto.name.trim();
      const existing = await tx.inventoryCategory.findUnique({ where: { name } });
      if (existing) {
        throw new BadRequestException('Uma categoria com este nome ja existe.');
      }
      const category = await tx.inventoryCategory.create({
        data: { name },
      });
      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.INVENTORY_ITEM,
        entityId: category.id,
        actorUserId,
        after: category,
      });
      return category;
    });
  }

  async deleteCategory(id: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.inventoryCategory.findUnique({
        where: { id },
        include: { items: { select: { id: true } } }
      });
      if (!category) throw new NotFoundException('Categoria nao encontrada.');
      if (category.items.length > 0) {
        throw new BadRequestException('Nao e possivel deletar uma categoria associada a itens de estoque.');
      }
      await tx.inventoryCategory.delete({ where: { id } });
      await this.audit.log(tx, {
        action: AuditAction.DELETE,
        entity: AuditEntity.INVENTORY_ITEM,
        entityId: id,
        actorUserId,
        before: category,
      });
      return { success: true };
    });
  }
}
