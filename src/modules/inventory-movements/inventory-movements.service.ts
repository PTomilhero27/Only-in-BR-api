import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListInventoryMovementsDto } from './dto/list-inventory-movements.dto';

/**
 * Service de historico de movimentacoes.
 * Responsabilidade:
 * - Consultar o livro de estoque com filtros e paginacao.
 * - Nao altera quantidade; escritas ficam centralizadas em InventoryService.
 */
@Injectable()
export class InventoryMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista movimentos por item, reserva, feira, tipo e periodo. */
  async list(query: ListInventoryMovementsDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: any = {};

    if (query.itemId) where.itemId = query.itemId;
    if (query.reservationId) where.reservationId = query.reservationId;
    if (query.fairId) where.fairId = query.fairId;
    if (query.type) where.type = query.type;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [rows, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: { item: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      items: rows.map((m) => ({
        id: m.id,
        itemId: m.itemId,
        itemName: m.item.name,
        reservationId: m.reservationId,
        type: m.type,
        quantity: m.quantity,
        fairId: m.fairId,
        purpose: m.purpose,
        notes: m.notes,
        createdById: m.createdById,
        createdAt: m.createdAt.toISOString(),
      })),
      meta: { page, perPage, total },
    };
  }
}
