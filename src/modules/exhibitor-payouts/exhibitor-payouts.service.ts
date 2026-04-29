import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  ExhibitorPayoutStatus,
  PixKeyType,
} from '@prisma/client';
import { AuditService } from 'src/common/audit/audit.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateExhibitorPayoutDto } from './dto/create-exhibitor-payout.dto';
import { ListExhibitorPayoutsDto } from './dto/list-exhibitor-payouts.dto';
import { UpdateExhibitorPayoutDto } from './dto/update-exhibitor-payout.dto';

/**
 * Service de repasses de expositores.
 * Centraliza regras de negocio, validacoes de Owner/OwnerFair e transacoes com auditoria.
 */
@Injectable()
export class ExhibitorPayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(fairId: string, query: ListExhibitorPayoutsDto) {
    await this.requireFair(fairId);

    const search = query.search?.trim();
    const ownerWhere = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { document: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const ownerFairs = await this.prisma.ownerFair.findMany({
      where: {
        fairId,
        owner: ownerWhere,
        exhibitorPayout: query.status ? { status: query.status } : undefined,
      },
      include: {
        owner: true,
        exhibitorPayout: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return ownerFairs.map((ownerFair) => this.toResponse(ownerFair));
  }

  async create(
    fairId: string,
    dto: CreateExhibitorPayoutDto,
    actorUserId: string,
  ) {
    await this.requireFair(fairId);

    const ownerFair = await this.prisma.ownerFair.findUnique({
      where: { id: dto.ownerFairId },
      include: { owner: true, fair: { include: { occurrences: true } } },
    });

    if (!ownerFair || ownerFair.fairId !== fairId) {
      throw new BadRequestException(
        'ownerFairId deve pertencer a feira da rota.',
      );
    }

    this.assertOwnerPixConfigured(ownerFair.owner);
    this.assertDueDateAllowed(dto.dueDate, ownerFair.fair.occurrences);

    const discountAmountCents = dto.discountAmountCents ?? 0;
    const adjustmentAmountCents = dto.adjustmentAmountCents ?? 0;
    const netAmountCents = this.calculateNet(
      dto.grossAmountCents,
      discountAmountCents,
      adjustmentAmountCents,
    );

    if (netAmountCents <= 0) {
      throw new BadRequestException(
        'netAmountCents deve ser maior que zero para gerar remessa.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const payout = await tx.exhibitorPayout.create({
        data: {
          ownerFairId: dto.ownerFairId,
          grossAmountCents: dto.grossAmountCents,
          discountAmountCents,
          adjustmentAmountCents,
          netAmountCents,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes ?? null,
          createdByUserId: actorUserId,
        },
        include: { ownerFair: { include: { owner: true } } },
      });

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.EXHIBITOR_PAYOUT,
        entityId: payout.id,
        actorUserId,
        after: payout,
        meta: { fairId },
      });

      return payout;
    });

    return this.toResponse({ ...created.ownerFair, exhibitorPayout: created });
  }

  async update(
    fairId: string,
    payoutId: string,
    dto: UpdateExhibitorPayoutDto,
    actorUserId: string,
  ) {
    const existing = await this.findPayoutInFair(fairId, payoutId);

    if (existing.status === ExhibitorPayoutStatus.PAID) {
      throw new ConflictException('Nao e permitido editar repasse ja pago.');
    }

    const changesFinancialData =
      dto.grossAmountCents !== undefined ||
      dto.discountAmountCents !== undefined ||
      dto.adjustmentAmountCents !== undefined ||
      dto.dueDate !== undefined;

    if (
      existing.status === ExhibitorPayoutStatus.INCLUDED_IN_REMITTANCE &&
      changesFinancialData
    ) {
      throw new ConflictException(
        'Repasse incluido em remessa permite editar somente notes. Cancele a remessa antes.',
      );
    }

    this.assertDueDateAllowed(
      dto.dueDate ?? undefined,
      existing.ownerFair.fair.occurrences,
    );

    const grossAmountCents = dto.grossAmountCents ?? existing.grossAmountCents;
    const discountAmountCents =
      dto.discountAmountCents ?? existing.discountAmountCents;
    const adjustmentAmountCents =
      dto.adjustmentAmountCents ?? existing.adjustmentAmountCents;
    const netAmountCents = this.calculateNet(
      grossAmountCents,
      discountAmountCents,
      adjustmentAmountCents,
    );

    if (netAmountCents <= 0) {
      throw new BadRequestException(
        'netAmountCents deve ser maior que zero para gerar remessa.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const payout = await tx.exhibitorPayout.update({
        where: { id: payoutId },
        data: {
          grossAmountCents: changesFinancialData ? grossAmountCents : undefined,
          discountAmountCents: changesFinancialData
            ? discountAmountCents
            : undefined,
          adjustmentAmountCents: changesFinancialData
            ? adjustmentAmountCents
            : undefined,
          netAmountCents: changesFinancialData ? netAmountCents : undefined,
          dueDate:
            dto.dueDate !== undefined
              ? dto.dueDate
                ? new Date(dto.dueDate)
                : null
              : undefined,
          notes: dto.notes !== undefined ? (dto.notes ?? null) : undefined,
        },
        include: { ownerFair: { include: { owner: true } } },
      });

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.EXHIBITOR_PAYOUT,
        entityId: payout.id,
        actorUserId,
        before: existing,
        after: payout,
        meta: { fairId },
      });

      return payout;
    });

    return this.toResponse({ ...updated.ownerFair, exhibitorPayout: updated });
  }

  async delete(fairId: string, payoutId: string, actorUserId: string) {
    const existing = await this.findPayoutInFair(fairId, payoutId);

    if (existing.status === ExhibitorPayoutStatus.PENDING) {
      await this.prisma.$transaction(async (tx) => {
        await tx.exhibitorPayout.delete({ where: { id: payoutId } });
        await this.audit.log(tx, {
          action: AuditAction.DELETE,
          entity: AuditEntity.EXHIBITOR_PAYOUT,
          entityId: payoutId,
          actorUserId,
          before: existing,
          meta: { fairId },
        });
      });

      return { id: payoutId, status: 'DELETED' };
    }

    if (existing.status === ExhibitorPayoutStatus.PAID) {
      throw new ConflictException('Nao e permitido cancelar repasse ja pago.');
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const payout = await tx.exhibitorPayout.update({
        where: { id: payoutId },
        data: { status: ExhibitorPayoutStatus.CANCELLED },
      });

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.EXHIBITOR_PAYOUT,
        entityId: payoutId,
        actorUserId,
        before: existing,
        after: payout,
        meta: { fairId, cancelled: true },
      });

      return payout;
    });

    return cancelled;
  }

  private async requireFair(fairId: string) {
    const fair = await this.prisma.fair.findUnique({
      where: { id: fairId },
      select: { id: true },
    });
    if (!fair) throw new NotFoundException('Feira nao encontrada.');
  }

  private async findPayoutInFair(fairId: string, payoutId: string) {
    const payout = await this.prisma.exhibitorPayout.findUnique({
      where: { id: payoutId },
      include: {
        ownerFair: {
          include: {
            owner: true,
            fair: { include: { occurrences: true } },
          },
        },
      },
    });

    if (!payout || payout.ownerFair.fairId !== fairId) {
      throw new NotFoundException(
        'Repasse de expositor nao encontrado nesta feira.',
      );
    }

    return payout;
  }

  private calculateNet(gross: number, discount: number, adjustment: number) {
    const net = gross - discount + adjustment;
    if (gross < 0 || discount < 0) {
      throw new BadRequestException(
        'grossAmountCents e discountAmountCents devem ser maiores ou iguais a zero.',
      );
    }
    return net;
  }

  private assertOwnerPixConfigured(owner: {
    pixKey?: string | null;
    pixKeyType?: PixKeyType | null;
    document?: string | null;
  }) {
    if (!owner.pixKey || !owner.pixKeyType) {
      throw new BadRequestException(
        'O expositor nao possui chave PIX configurada.',
      );
    }

    if (!owner.document) {
      throw new BadRequestException(
        'O expositor nao possui documento configurado.',
      );
    }
  }

  private assertDueDateAllowed(
    dueDate: string | undefined,
    occurrences: { endsAt: Date }[],
  ) {
    if (!dueDate || occurrences.length === 0) return;

    const due = new Date(dueDate);
    const fairEndsAt = occurrences.reduce<Date | null>((max, occurrence) => {
      if (!max || occurrence.endsAt > max) return occurrence.endsAt;
      return max;
    }, null);

    if (fairEndsAt && due < fairEndsAt) {
      throw new BadRequestException(
        'dueDate nao pode ser anterior ao fim da feira.',
      );
    }
  }

  private toResponse(ownerFair: any) {
    const payout = ownerFair.exhibitorPayout;
    const paidAmountCents = payout?.paidAmountCents ?? 0;
    const netAmountCents = payout?.netAmountCents ?? 0;

    return {
      ownerFairId: ownerFair.id,
      ownerId: ownerFair.ownerId,
      name: ownerFair.owner.fullName ?? ownerFair.owner.bankHolderName ?? null,
      document: ownerFair.owner.bankHolderDoc ?? ownerFair.owner.document,
      email: ownerFair.owner.email ?? null,
      phone: ownerFair.owner.phone ?? null,
      pixKeyType: ownerFair.owner.pixKeyType ?? null,
      pixKey: ownerFair.owner.pixKey ?? null,
      grossAmountCents: payout?.grossAmountCents ?? 0,
      discountAmountCents: payout?.discountAmountCents ?? 0,
      adjustmentAmountCents: payout?.adjustmentAmountCents ?? 0,
      netAmountCents,
      paidAmountCents,
      pendingAmountCents: Math.max(netAmountCents - paidAmountCents, 0),
      status: payout?.status ?? ExhibitorPayoutStatus.PENDING,
      dueDate: payout?.dueDate ?? null,
      paidAt: payout?.paidAt ?? null,
    };
  }
}
