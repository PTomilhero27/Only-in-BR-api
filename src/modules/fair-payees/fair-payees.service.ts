import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ExhibitorPayoutStatus,
  FairSupplierInstallmentStatus,
  PixKeyType,
  PixRemittancePayeeType,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListPayableItemsDto } from './dto/list-payable-items.dto';

type PayableItem = {
  payeeType: PixRemittancePayeeType;
  id: string;
  name: string;
  document: string;
  description: string;
  amountCents: number;
  dueDate: Date | null;
  pixKeyType: PixKeyType | null;
  pixKey: string | null;
};

/**
 * Service de favorecidos pagaveis da feira.
 * Centraliza consultas mistas para que a remessa PIX nao conheca detalhes de tela/listagem.
 */
@Injectable()
export class FairPayeesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPayableItems(fairId: string, query: ListPayableItemsDto) {
    await this.requireFair(fairId);

    const items: PayableItem[] = [];

    if (
      !query.payeeType ||
      query.payeeType === PixRemittancePayeeType.SUPPLIER
    ) {
      items.push(...(await this.listSupplierItems(fairId, query.search)));
    }

    if (
      !query.payeeType ||
      query.payeeType === PixRemittancePayeeType.EXHIBITOR
    ) {
      items.push(...(await this.listExhibitorItems(fairId, query.search)));
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async listSupplierItems(
    fairId: string,
    search?: string,
  ): Promise<PayableItem[]> {
    const trimmed = search?.trim();
    const installments = await this.prisma.fairSupplierInstallment.findMany({
      where: {
        status: FairSupplierInstallmentStatus.PENDING,
        supplier: {
          fairId,
          ...(trimmed
            ? {
                OR: [
                  { name: { contains: trimmed, mode: 'insensitive' as const } },
                  {
                    document: {
                      contains: trimmed,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    description: {
                      contains: trimmed,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              }
            : {}),
        },
      },
      include: { supplier: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    return installments.map((installment) => ({
      payeeType: PixRemittancePayeeType.SUPPLIER,
      id: installment.id,
      name: installment.supplier.name,
      document: installment.supplier.document,
      description:
        installment.description ??
        `Parcela ${installment.number} - ${installment.supplier.name}`,
      amountCents: installment.amountCents,
      dueDate: installment.dueDate,
      pixKeyType: installment.supplier.pixKeyType,
      pixKey: installment.supplier.pixKey,
    }));
  }

  private async listExhibitorItems(
    fairId: string,
    search?: string,
  ): Promise<PayableItem[]> {
    const trimmed = search?.trim();
    const payouts = await this.prisma.exhibitorPayout.findMany({
      where: {
        status: ExhibitorPayoutStatus.PENDING,
        netAmountCents: { gt: 0 },
        ownerFair: {
          fairId,
          owner: trimmed
            ? {
                OR: [
                  {
                    fullName: {
                      contains: trimmed,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    document: {
                      contains: trimmed,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    email: { contains: trimmed, mode: 'insensitive' as const },
                  },
                  {
                    phone: { contains: trimmed, mode: 'insensitive' as const },
                  },
                  {
                    bankHolderName: {
                      contains: trimmed,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              }
            : undefined,
        },
      },
      include: { ownerFair: { include: { owner: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    return payouts.map((payout) => {
      const owner = payout.ownerFair.owner;
      return {
        payeeType: PixRemittancePayeeType.EXHIBITOR,
        id: payout.id,
        name: owner.bankHolderName ?? owner.fullName ?? 'Expositor sem nome',
        document: owner.bankHolderDoc ?? owner.document,
        description: 'Repasse pos-evento',
        amountCents: payout.netAmountCents,
        dueDate: payout.dueDate,
        pixKeyType: owner.pixKeyType,
        pixKey: owner.pixKey,
      };
    });
  }

  private async requireFair(fairId: string) {
    const fair = await this.prisma.fair.findUnique({
      where: { id: fairId },
      select: { id: true },
    });
    if (!fair) throw new NotFoundException('Feira nao encontrada.');
  }
}
