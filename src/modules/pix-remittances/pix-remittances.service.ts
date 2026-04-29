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
  FairSupplierInstallmentStatus,
  FairSupplierStatus,
  PixRemittancePayeeType,
  PixRemittanceStatus,
} from '@prisma/client';
import { AuditService } from 'src/common/audit/audit.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreatePixRemittanceDto,
  CreatePixRemittanceItemDto,
} from './dto/create-pix-remittance.dto';
import { SispagPixRemittanceFileService } from './sispag-pix-remittance-file.service';

/**
 * Service de remessas PIX da feira.
 * Orquestra validacoes, snapshots, transacoes e mudancas de status de fornecedores/expositores.
 */
@Injectable()
export class PixRemittancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fileService: SispagPixRemittanceFileService,
  ) {}

  async list(fairId: string) {
    await this.requireFair(fairId);
    return this.prisma.pixRemittance.findMany({
      where: { fairId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    fairId: string,
    dto: CreatePixRemittanceDto,
    actorUserId: string,
  ) {
    await this.requireFair(fairId);

    if (!dto.items?.length) {
      throw new BadRequestException(
        'Informe ao menos um item para gerar a remessa.',
      );
    }

    dto.items.forEach((item) => this.assertItemShape(item));
    this.assertNoDuplicateItems(dto.items);

    const supplierItems = await this.loadSupplierItems(fairId, dto.items);
    const exhibitorItems = await this.loadExhibitorItems(fairId, dto.items);
    const normalizedItems = [...supplierItems, ...exhibitorItems];

    if (!normalizedItems.length) {
      throw new BadRequestException('Nenhum item valido para remessa.');
    }

    const paymentDate = new Date(dto.paymentDate);
    if (Number.isNaN(paymentDate.getTime())) {
      throw new BadRequestException('paymentDate invalido.');
    }

    return this.prisma.$transaction(async (tx) => {
      const remittance = await tx.pixRemittance.create({
        data: {
          fairId,
          paymentDate,
          description: dto.description ?? null,
          totalItems: normalizedItems.length,
          totalAmountCents: normalizedItems.reduce(
            (sum, item) => sum + item.amountCents,
            0,
          ),
          createdByUserId: actorUserId,
        },
      });

      const file = this.fileService.generate({
        fairId,
        remittanceId: remittance.id,
        paymentDate,
        items: normalizedItems,
      });

      await tx.pixRemittance.update({
        where: { id: remittance.id },
        data: file,
      });

      await tx.pixRemittanceItem.createMany({
        data: normalizedItems.map((item) => ({
          pixRemittanceId: remittance.id,
          payeeType: item.payeeType,
          supplierInstallmentId: item.supplierInstallmentId ?? null,
          exhibitorPayoutId: item.exhibitorPayoutId ?? null,
          amountCents: item.amountCents,
          payeeName: item.payeeName,
          payeeDocument: item.payeeDocument,
          pixKeyType: item.pixKeyType,
          pixKey: item.pixKey,
          txId: item.txId ?? null,
        })),
      });

      for (const item of supplierItems) {
        await tx.fairSupplierInstallment.update({
          where: { id: item.supplierInstallmentId },
          data: {
            status: FairSupplierInstallmentStatus.INCLUDED_IN_REMITTANCE,
          },
        });
      }

      for (const item of exhibitorItems) {
        await tx.exhibitorPayout.update({
          where: { id: item.exhibitorPayoutId },
          data: { status: ExhibitorPayoutStatus.INCLUDED_IN_REMITTANCE },
        });
      }

      const finalRemittance = await tx.pixRemittance.findUniqueOrThrow({
        where: { id: remittance.id },
        include: { items: true },
      });

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.PIX_REMITTANCE,
        entityId: remittance.id,
        actorUserId,
        after: finalRemittance,
        meta: { fairId },
      });

      return finalRemittance;
    });
  }

  async markPaid(fairId: string, remittanceId: string, actorUserId: string) {
    const remittance = await this.findRemittanceInFair(fairId, remittanceId);

    if (remittance.status !== PixRemittanceStatus.GENERATED) {
      throw new ConflictException(
        'Somente remessa gerada pode ser marcada como paga.',
      );
    }

    const paidAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      for (const item of remittance.items) {
        if (
          item.payeeType === PixRemittancePayeeType.SUPPLIER &&
          item.supplierInstallmentId
        ) {
          const installment = await tx.fairSupplierInstallment.update({
            where: { id: item.supplierInstallmentId },
            data: {
              status: FairSupplierInstallmentStatus.PAID,
              paidAt,
              paidAmountCents: item.amountCents,
            },
            include: { supplier: { include: { installments: true } } },
          });
          await this.recomputeSupplier(tx, installment.supplierId);
        }

        if (
          item.payeeType === PixRemittancePayeeType.EXHIBITOR &&
          item.exhibitorPayoutId
        ) {
          await tx.exhibitorPayout.update({
            where: { id: item.exhibitorPayoutId },
            data: {
              status: ExhibitorPayoutStatus.PAID,
              paidAt,
              paidAmountCents: item.amountCents,
            },
          });
        }
      }

      const updated = await tx.pixRemittance.update({
        where: { id: remittanceId },
        data: { status: PixRemittanceStatus.PAID, paidAt },
        include: { items: true },
      });

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.PIX_REMITTANCE,
        entityId: remittanceId,
        actorUserId,
        before: remittance,
        after: updated,
        meta: { fairId, paid: true },
      });

      return updated;
    });
  }

  async cancel(fairId: string, remittanceId: string, actorUserId: string) {
    const remittance = await this.findRemittanceInFair(fairId, remittanceId);

    if (remittance.status !== PixRemittanceStatus.GENERATED) {
      throw new ConflictException(
        'Somente remessa com status GENERATED pode ser cancelada.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of remittance.items) {
        if (
          item.payeeType === PixRemittancePayeeType.SUPPLIER &&
          item.supplierInstallmentId
        ) {
          await tx.fairSupplierInstallment.update({
            where: { id: item.supplierInstallmentId },
            data: { status: FairSupplierInstallmentStatus.PENDING },
          });
        }

        if (
          item.payeeType === PixRemittancePayeeType.EXHIBITOR &&
          item.exhibitorPayoutId
        ) {
          await tx.exhibitorPayout.update({
            where: { id: item.exhibitorPayoutId },
            data: { status: ExhibitorPayoutStatus.PENDING },
          });
        }
      }

      const updated = await tx.pixRemittance.update({
        where: { id: remittanceId },
        data: {
          status: PixRemittanceStatus.CANCELLED,
          cancelledAt: new Date(),
        },
        include: { items: true },
      });

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.PIX_REMITTANCE,
        entityId: remittanceId,
        actorUserId,
        before: remittance,
        after: updated,
        meta: { fairId, cancelled: true },
      });

      return updated;
    });
  }

  private async requireFair(fairId: string) {
    const fair = await this.prisma.fair.findUnique({
      where: { id: fairId },
      select: { id: true },
    });
    if (!fair) throw new NotFoundException('Feira nao encontrada.');
  }

  private async findRemittanceInFair(fairId: string, remittanceId: string) {
    const remittance = await this.prisma.pixRemittance.findUnique({
      where: { id: remittanceId },
      include: { items: true },
    });

    if (!remittance || remittance.fairId !== fairId) {
      throw new NotFoundException('Remessa PIX nao encontrada nesta feira.');
    }

    return remittance;
  }

  private assertItemShape(item: CreatePixRemittanceItemDto) {
    const hasSupplier = Boolean(item.supplierInstallmentId);
    const hasExhibitor = Boolean(item.exhibitorPayoutId);

    if (hasSupplier && hasExhibitor) {
      throw new BadRequestException(
        'Informe somente supplierInstallmentId ou exhibitorPayoutId.',
      );
    }

    if (!hasSupplier && !hasExhibitor) {
      throw new BadRequestException(
        'Informe um identificador de item pagavel.',
      );
    }

    if (item.payeeType === PixRemittancePayeeType.SUPPLIER && !hasSupplier) {
      throw new BadRequestException(
        'supplierInstallmentId e obrigatorio para payeeType=SUPPLIER.',
      );
    }

    if (item.payeeType === PixRemittancePayeeType.EXHIBITOR && !hasExhibitor) {
      throw new BadRequestException(
        'exhibitorPayoutId e obrigatorio para payeeType=EXHIBITOR.',
      );
    }
  }

  private assertNoDuplicateItems(items: CreatePixRemittanceItemDto[]) {
    const keys = items.map(
      (item) =>
        `${item.payeeType}:${item.supplierInstallmentId ?? item.exhibitorPayoutId}`,
    );
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException(
        'Nao e permitido repetir itens na mesma remessa.',
      );
    }
  }

  private async loadSupplierItems(
    fairId: string,
    items: CreatePixRemittanceItemDto[],
  ) {
    const ids = items
      .filter((item) => item.payeeType === PixRemittancePayeeType.SUPPLIER)
      .map((item) => item.supplierInstallmentId as string);

    if (!ids.length) return [];

    const installments = await this.prisma.fairSupplierInstallment.findMany({
      where: { id: { in: ids } },
      include: { supplier: true },
    });

    if (installments.length !== ids.length) {
      throw new NotFoundException(
        'Uma ou mais parcelas de fornecedor nao foram encontradas.',
      );
    }

    return installments.map((installment) => {
      if (installment.supplier.fairId !== fairId) {
        throw new BadRequestException(
          'Parcela de fornecedor nao pertence a feira da rota.',
        );
      }
      if (installment.status !== FairSupplierInstallmentStatus.PENDING) {
        throw new ConflictException(
          'Parcela de fornecedor deve estar PENDING.',
        );
      }

      return {
        payeeType: PixRemittancePayeeType.SUPPLIER,
        supplierInstallmentId: installment.id,
        exhibitorPayoutId: null,
        amountCents: installment.amountCents,
        payeeName: installment.supplier.name,
        payeeDocument: installment.supplier.document,
        pixKeyType: installment.supplier.pixKeyType,
        pixKey: installment.supplier.pixKey,
        txId: null,
      };
    });
  }

  private async loadExhibitorItems(
    fairId: string,
    items: CreatePixRemittanceItemDto[],
  ) {
    const ids = items
      .filter((item) => item.payeeType === PixRemittancePayeeType.EXHIBITOR)
      .map((item) => item.exhibitorPayoutId as string);

    if (!ids.length) return [];

    const payouts = await this.prisma.exhibitorPayout.findMany({
      where: { id: { in: ids } },
      include: { ownerFair: { include: { owner: true } } },
    });

    if (payouts.length !== ids.length) {
      throw new NotFoundException(
        'Um ou mais repasses de expositor nao foram encontrados.',
      );
    }

    return payouts.map((payout) => {
      if (payout.ownerFair.fairId !== fairId) {
        throw new BadRequestException(
          'Repasse de expositor nao pertence a feira da rota.',
        );
      }
      if (payout.status !== ExhibitorPayoutStatus.PENDING) {
        throw new ConflictException('Repasse de expositor deve estar PENDING.');
      }
      if (payout.netAmountCents <= 0) {
        throw new BadRequestException(
          'Repasse de expositor deve ter valor liquido maior que zero.',
        );
      }

      const owner = payout.ownerFair.owner;
      if (!owner.pixKey || !owner.pixKeyType) {
        throw new BadRequestException(
          'O expositor nao possui chave PIX configurada.',
        );
      }

      const payeeDocument = owner.bankHolderDoc ?? owner.document;
      if (!payeeDocument) {
        throw new BadRequestException(
          'O expositor nao possui documento configurado.',
        );
      }

      return {
        payeeType: PixRemittancePayeeType.EXHIBITOR,
        supplierInstallmentId: null,
        exhibitorPayoutId: payout.id,
        amountCents: payout.netAmountCents,
        payeeName:
          owner.bankHolderName ?? owner.fullName ?? 'Expositor sem nome',
        payeeDocument,
        pixKeyType: owner.pixKeyType,
        pixKey: owner.pixKey,
        txId: null,
      };
    });
  }

  private async recomputeSupplier(tx: any, supplierId: string) {
    const supplier = await tx.fairSupplier.findUniqueOrThrow({
      where: { id: supplierId },
      include: { installments: true },
    });

    const paidAmountCents = supplier.installments.reduce(
      (sum, item) => sum + (item.paidAmountCents ?? 0),
      0,
    );
    const pendingAmountCents = Math.max(
      supplier.totalAmountCents - paidAmountCents,
      0,
    );
    let status: FairSupplierStatus = FairSupplierStatus.PENDING;
    if (paidAmountCents >= supplier.totalAmountCents)
      status = FairSupplierStatus.PAID;
    else if (paidAmountCents > 0) status = FairSupplierStatus.PARTIALLY_PAID;

    await tx.fairSupplier.update({
      where: { id: supplierId },
      data: { paidAmountCents, pendingAmountCents, status },
    });
  }
}
