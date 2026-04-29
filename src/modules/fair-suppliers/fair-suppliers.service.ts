import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  FairSupplierInstallmentStatus,
  FairSupplierStatus,
} from '@prisma/client';
import { AuditService } from 'src/common/audit/audit.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFairSupplierDto } from './dto/create-fair-supplier.dto';
import { UpdateFairSupplierDto } from './dto/update-fair-supplier.dto';

/**
 * Service de fornecedores/prestadores por feira.
 * Mantem o cadastro separado dos expositores e recalcula totais/status das parcelas.
 */
@Injectable()
export class FairSuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(fairId: string) {
    await this.requireFair(fairId);
    return this.prisma.fairSupplier.findMany({
      where: { fairId },
      include: { installments: { orderBy: { number: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    fairId: string,
    dto: CreateFairSupplierDto,
    actorUserId: string,
  ) {
    await this.requireFair(fairId);
    this.assertUniqueInstallmentNumbers(dto.installments);

    const totalAmountCents = dto.installments.reduce(
      (sum, item) => sum + item.amountCents,
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.fairSupplier.create({
        data: {
          fairId,
          name: dto.name,
          document: this.onlyDigits(dto.document),
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          pixKeyType: dto.pixKeyType,
          pixKey: dto.pixKey,
          description: dto.description ?? null,
          totalAmountCents,
          pendingAmountCents: totalAmountCents,
          createdByUserId: actorUserId,
          installments: {
            create: dto.installments.map((installment) => ({
              number: installment.number,
              amountCents: installment.amountCents,
              dueDate: installment.dueDate
                ? new Date(installment.dueDate)
                : null,
              description: installment.description ?? null,
            })),
          },
        },
        include: { installments: { orderBy: { number: 'asc' } } },
      });

      await this.audit.log(tx, {
        action: AuditAction.CREATE,
        entity: AuditEntity.FAIR_SUPPLIER,
        entityId: supplier.id,
        actorUserId,
        after: supplier,
        meta: { fairId },
      });

      return supplier;
    });
  }

  async update(
    fairId: string,
    supplierId: string,
    dto: UpdateFairSupplierDto,
    actorUserId: string,
  ) {
    const existing = await this.findSupplierInFair(fairId, supplierId);

    if (dto.installments?.some((item) => item.amountCents <= 0)) {
      throw new BadRequestException('Parcelas devem ter valor maior que zero.');
    }

    if (dto.installments) {
      this.assertUniqueInstallmentNumbers(dto.installments);
      const locked = existing.installments.some(
        (item) => item.status !== FairSupplierInstallmentStatus.PENDING,
      );
      if (locked) {
        throw new ConflictException(
          'Nao e permitido substituir parcelas que ja entraram em remessa ou pagamento.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.installments) {
        await tx.fairSupplierInstallment.deleteMany({ where: { supplierId } });
      }

      const totalAmountCents =
        dto.installments?.reduce((sum, item) => sum + item.amountCents, 0) ??
        existing.totalAmountCents;
      const paidAmountCents = existing.paidAmountCents;
      const pendingAmountCents = Math.max(
        totalAmountCents - paidAmountCents,
        0,
      );

      const supplier = await tx.fairSupplier.update({
        where: { id: supplierId },
        data: {
          name: dto.name,
          document: dto.document ? this.onlyDigits(dto.document) : undefined,
          email: dto.email !== undefined ? (dto.email ?? null) : undefined,
          phone: dto.phone !== undefined ? (dto.phone ?? null) : undefined,
          pixKeyType: dto.pixKeyType,
          pixKey: dto.pixKey,
          description:
            dto.description !== undefined
              ? (dto.description ?? null)
              : undefined,
          totalAmountCents,
          pendingAmountCents,
          status: this.computeSupplierStatus(
            totalAmountCents,
            paidAmountCents,
            pendingAmountCents,
          ),
          installments: dto.installments
            ? {
                create: dto.installments.map((installment) => ({
                  number: installment.number,
                  amountCents: installment.amountCents,
                  dueDate: installment.dueDate
                    ? new Date(installment.dueDate)
                    : null,
                  description: installment.description ?? null,
                })),
              }
            : undefined,
        },
        include: { installments: { orderBy: { number: 'asc' } } },
      });

      await this.audit.log(tx, {
        action: AuditAction.UPDATE,
        entity: AuditEntity.FAIR_SUPPLIER,
        entityId: supplierId,
        actorUserId,
        before: existing,
        after: supplier,
        meta: { fairId },
      });

      return supplier;
    });
  }

  async delete(fairId: string, supplierId: string, actorUserId: string) {
    const existing = await this.findSupplierInFair(fairId, supplierId);
    const hasHistory = existing.installments.some(
      (item) => item.status !== FairSupplierInstallmentStatus.PENDING,
    );

    if (hasHistory) {
      throw new ConflictException(
        'Fornecedor com remessa/pagamento nao pode ser apagado fisicamente.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.fairSupplier.delete({ where: { id: supplierId } });
      await this.audit.log(tx, {
        action: AuditAction.DELETE,
        entity: AuditEntity.FAIR_SUPPLIER,
        entityId: supplierId,
        actorUserId,
        before: existing,
        meta: { fairId },
      });
    });

    return { id: supplierId, status: 'DELETED' };
  }

  private async requireFair(fairId: string) {
    const fair = await this.prisma.fair.findUnique({
      where: { id: fairId },
      select: { id: true },
    });
    if (!fair) throw new NotFoundException('Feira nao encontrada.');
  }

  private async findSupplierInFair(fairId: string, supplierId: string) {
    const supplier = await this.prisma.fairSupplier.findUnique({
      where: { id: supplierId },
      include: { installments: true },
    });

    if (!supplier || supplier.fairId !== fairId) {
      throw new NotFoundException(
        'Fornecedor/prestador nao encontrado nesta feira.',
      );
    }

    return supplier;
  }

  private assertUniqueInstallmentNumbers(installments: { number: number }[]) {
    const unique = new Set(installments.map((item) => item.number));
    if (unique.size !== installments.length) {
      throw new BadRequestException(
        'Nao e permitido repetir o numero da parcela.',
      );
    }
  }

  private computeSupplierStatus(total: number, paid: number, pending: number) {
    if (total > 0 && paid >= total) return FairSupplierStatus.PAID;
    if (paid > 0) return FairSupplierStatus.PARTIALLY_PAID;
    if (pending <= 0) return FairSupplierStatus.PAID;
    return FairSupplierStatus.PENDING;
  }

  private onlyDigits(value: string) {
    return value.replace(/\D/g, '');
  }
}
