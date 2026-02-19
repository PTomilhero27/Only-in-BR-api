/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import {
  FairStatus,
  OwnerFairPaymentStatus,
  OwnerFairStatus,
  StallSize,
} from '@prisma/client';

import { ListMyFairsResponseDto } from './dto/list-my-fairs.response.dto';
import { ExhibitorFairListItemDto } from './dto/exhibitor-fair-list-item.dto';
import { LinkStallResponseDto } from './dto/link-stall.response.dto';
import { UnlinkStallResponseDto } from './dto/unlink-stall.response.dto';
import { ExhibitorFairPaymentSummaryDto } from './dto/exhibitor-fair-payment-summary.dto';
import {
  ExhibitorFairContractStatus,
  ExhibitorFairContractSummaryDto,
} from './dto/exhibitor-fair-contract-summary.dto';
import { ExhibitorFairPurchaseDto } from './dto/exhibitor-fair-purchase.dto';
import { ExhibitorLinkedStallDto } from './dto/exhibitor-linked-stall.dto';

/**
 * Tipagem auxiliar (lite) para montar o summary de pagamento.
 * Obs.: Mantemos no service para evitar vazar tipos do Prisma diretamente no DTO.
 */
type PurchaseLite = {
  id: string;
  stallSize: StallSize;
  qty: number;
  usedQty: number;
  unitPriceCents: number;
  totalCents: number;
  paidCents: number;
  installmentsCount: number;
  status: OwnerFairPaymentStatus;
  fairTaxId: string | null;
  fairTax: {
    id: string;
    name: string;
    percentBps: number;
    isActive: boolean;
  } | null;
  installments: Array<{
    number: number;
    dueDate: Date;
    amountCents: number;
    paidAt: Date | null;
    paidAmountCents: number | null;
  }>;
};

@Injectable()
export class ExhibitorFairsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------
  // Auth helper
  // ---------------------------------------------
  /**
   * Resolve ownerId a partir do userId do JWT.
   *
   * Por que:
   * - O Portal autentica via User (role EXHIBITOR)
   * - A regra de negócio do portal sempre opera em Owner (expositor)
   */
  private async getOwnerIdOrThrow(userId: string): Promise<string> {
    if (!userId) throw new BadRequestException('userId ausente no token.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, ownerId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Usuário não encontrado ou inativo.');
    }

    if (!user.ownerId) {
      throw new BadRequestException(
        'Este usuário não está vinculado a um expositor (ownerId).',
      );
    }

    return user.ownerId;
  }

  // ---------------------------------------------
  // Helpers de datas (pagamentos)
  // ---------------------------------------------
  private day0(d: Date) {
    // Normaliza para 00:00:00 local, para comparar "atraso" por dia.
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // ---------------------------------------------
  // Contract helpers
  // ---------------------------------------------
  /**
   * Constrói um resumo de contrato (por feira) a partir do OwnerFair + Contract.
   * Obs.: contrato é por OwnerFair, não por barraca.
   */
  private buildContractSummary(input: {
    contract: {
      id: string;
      pdfPath: string | null;
      signUrl: string | null;
      signUrlExpiresAt: Date | null;
      signedAt?: Date | null; // ✅ novo (opcional pra compatibilidade)
      updatedAt: Date;
    } | null;
    contractSignedAt: Date | null;
  }): ExhibitorFairContractSummaryDto | null {
    const { contract, contractSignedAt } = input;
    if (!contract) return null;

    const now = new Date();

    const hasPdf = !!contract.pdfPath;

    const hasSignUrl = !!contract.signUrl && !!contract.signUrlExpiresAt;
    const signUrlValid =
      hasSignUrl &&
      (contract.signUrlExpiresAt as Date).getTime() > now.getTime();

    // ✅ fonte de verdade: Contract.signedAt (se existir), senão fallback no OwnerFair.contractSignedAt
    const signedAt = contract.signedAt ?? contractSignedAt ?? null;
    const isSigned = !!signedAt;

    // Status derivado para UX do portal
    const status: ExhibitorFairContractStatus = isSigned
      ? ExhibitorFairContractStatus.SIGNED
      : signUrlValid
        ? ExhibitorFairContractStatus.AWAITING_SIGNATURE
        : hasPdf
          ? ExhibitorFairContractStatus.ISSUED
          : ExhibitorFairContractStatus.NOT_ISSUED;

    return {
      contractId: contract.id,
      status,
      pdfPath: contract.pdfPath,
      signUrl: signUrlValid ? contract.signUrl : null,
      signUrlExpiresAt: signUrlValid
        ? (contract.signUrlExpiresAt?.toISOString() ?? null)
        : null,
      signedAt: signedAt ? signedAt.toISOString() : null,
      updatedAt: contract.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------
  // Payment helpers (agregado por feira) - via PURCHASES
  // ---------------------------------------------
  /**
   * Summary agregado (por feira) baseado nas compras.
   * Importante:
   * - Portal não altera pagamentos, apenas exibe
   * - Fonte de verdade financeira é OwnerFairPurchase/Installments
   */
  private buildPaymentSummaryFromPurchases(
    purchases: PurchaseLite[],
  ): ExhibitorFairPaymentSummaryDto | null {
    const items = Array.isArray(purchases) ? purchases : [];
    if (items.length === 0) return null;

    const totalCents = items.reduce((acc, p) => acc + (p.totalCents ?? 0), 0);
    const installmentsCount = items.reduce(
      (acc, p) => acc + (p.installmentsCount ?? 0),
      0,
    );

    const allInstallments = items.flatMap((p) => {
      const inst = Array.isArray(p.installments) ? p.installments : [];
      return inst.map((i) => ({
        purchaseId: p.id,
        stallSize: p.stallSize,
        number: i.number,
        dueDate: i.dueDate,
        amountCents: i.amountCents,
        paidAt: i.paidAt ?? null,
        paidAmountCents: i.paidAmountCents ?? null,
      }));
    });

    const paidCount = allInstallments.filter((i) => !!i.paidAt).length;

    const nextOpen = allInstallments
      .filter((i) => !i.paidAt)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

    const nextDueDate = nextOpen ? nextOpen.dueDate.toISOString() : null;

    const statuses = items.map(
      (p) =>
        (p.status as OwnerFairPaymentStatus) ?? OwnerFairPaymentStatus.PENDING,
    );

    const now = new Date();
    const today0 = this.day0(now);

    const hasOverdueInstallment = allInstallments.some((i) => {
      if (i.paidAt) return false;
      const due0 = this.day0(i.dueDate);
      return due0.getTime() < today0.getTime();
    });

    const anyOverdue =
      hasOverdueInstallment ||
      statuses.includes(OwnerFairPaymentStatus.OVERDUE);

    const allPaid =
      items.length > 0 &&
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
      installmentsCount,
      paidCount,
      nextDueDate,
      installments: allInstallments
        .slice()
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .map((i) => ({
          purchaseId: i.purchaseId,
          stallSize: i.stallSize,
          number: i.number,
          dueDate: i.dueDate.toISOString(),
          amountCents: i.amountCents,
          paidAt: i.paidAt ? i.paidAt.toISOString() : null,
          paidAmountCents: i.paidAmountCents ?? null,
        })),
    };
  }

  // ---------------------------------------------
  // List (minhas feiras)
  // ---------------------------------------------
  /**
   * Lista as feiras do expositor logado.
   *
   * Retorna tudo que a tela precisa:
   * - feira + status operacional (OwnerFairStatus)
   * - contrato (status + link + pdfPath)
   * - compras (linhas 1 por 1) e parcelas
   * - barracas vinculadas (StallFair) + qual purchase está sendo consumida
   */
  async listMyFairsByMe(userId: string): Promise<ListMyFairsResponseDto> {
    const ownerId = await this.getOwnerIdOrThrow(userId);

    const ownerFairs = await this.prisma.ownerFair.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        fair: {
          select: {
            id: true,
            name: true,
            status: true,
            taxes: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                name: true,
                percentBps: true,
                isActive: true,
              },
            },
          },
        },

        // ✅ contrato por feira/expositor (inclui signedAt pra UI)
        contract: {
          select: {
            id: true,
            pdfPath: true,
            signUrl: true,
            signUrlExpiresAt: true,
            signedAt: true,
            updatedAt: true,
          },
        },

        // ✅ barracas vinculadas (com purchase consumida + taxa por barraca)
        stallFairs: {
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,

            taxId: true,
            taxNameSnapshot: true,
            taxPercentBpsSnapshot: true,

            stall: { select: { id: true, pdvName: true, stallSize: true } },

            purchase: {
              select: {
                id: true,
                stallSize: true,
                qty: true,
                usedQty: true,
                unitPriceCents: true,
                totalCents: true,
                paidCents: true,
                installmentsCount: true,
                status: true,
              },
            },
          },
        },

        // ✅ compras (fonte do pagamento e controle de consumo) + taxa por compra
        ownerFairPurchases: {
          orderBy: { createdAt: 'asc' },
          include: {
            installments: { orderBy: { number: 'asc' } },
            fairTax: {
              select: {
                id: true,
                name: true,
                percentBps: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    const items: ExhibitorFairListItemDto[] = ownerFairs.map((of) => {
      const linked = of.stallFairs ?? [];
      const purchases = (of.ownerFairPurchases ??
        []) as unknown as PurchaseLite[];

      const paymentSummary = this.buildPaymentSummaryFromPurchases(purchases);

      const contractSummary = this.buildContractSummary({
        contract: of.contract
          ? {
              id: of.contract.id,
              pdfPath: of.contract.pdfPath ?? null,
              signUrl: of.contract.signUrl ?? null,
              signUrlExpiresAt: of.contract.signUrlExpiresAt ?? null,
              updatedAt: of.contract.updatedAt,
              signedAt: of.contract.signedAt ?? null,
            }
          : null,
        contractSignedAt: of.contractSignedAt ?? null,
      });

      const purchasesDto: ExhibitorFairPurchaseDto[] = purchases.map((p) => ({
        id: p.id,
        stallSize: p.stallSize,
        qty: p.qty,
        usedQty: p.usedQty,
        remainingQty: Math.max(0, (p.qty ?? 0) - (p.usedQty ?? 0)),

        unitPriceCents: p.unitPriceCents ?? 0,
        totalCents: p.totalCents ?? 0,
        paidCents: p.paidCents ?? 0,

        installmentsCount: p.installmentsCount ?? 0,
        status: p.status ?? OwnerFairPaymentStatus.PENDING,

        // ✅ taxa por compra
        fairTaxId: p.fairTaxId ?? null,
        fairTaxName: p.fairTax?.name ?? null,
        fairTaxPercentBps: p.fairTax?.percentBps ?? null,

        installments: (p.installments ?? []).map((i) => ({
          number: i.number,
          dueDate: i.dueDate.toISOString(),
          amountCents: i.amountCents,
          paidAt: i.paidAt ? i.paidAt.toISOString() : null,
          paidAmountCents: i.paidAmountCents ?? null,
        })),
      }));

      const linkedStallsDto: ExhibitorLinkedStallDto[] = linked.map((sf) => ({
        stallId: sf.stall.id,
        pdvName: sf.stall.pdvName,
        stallSize: sf.stall.stallSize as StallSize,
        linkedAt: sf.createdAt.toISOString(),

        purchaseId: sf.purchase?.id ?? null,
        purchaseStatus: (sf.purchase?.status as OwnerFairPaymentStatus) ?? null,

        purchaseUnitPriceCents: sf.purchase?.unitPriceCents ?? null,
        purchaseTotalCents: sf.purchase?.totalCents ?? null,
        purchasePaidCents: sf.purchase?.paidCents ?? null,
        purchaseInstallmentsCount: sf.purchase?.installmentsCount ?? null,

        // ✅ taxa por barraca vinculada (snapshot)
        taxId: sf.taxId ?? null,
        taxNameSnapshot: sf.taxNameSnapshot ?? null,
        taxPercentBpsSnapshot: sf.taxPercentBpsSnapshot ?? null,
      }));

      return {
        fairId: of.fair.id,
        fairName: of.fair.name,
        fairStatus: of.fair.status as FairStatus,

        ownerFairStatus: of.status as OwnerFairStatus,

        stallsQtyPurchased: of.stallsQty,
        stallsLinkedQty: linked.length,

        contract: contractSummary,
        purchases: purchasesDto,
        linkedStalls: linkedStallsDto,

        paymentSummary,

        // ✅ taxas cadastradas na feira (opções para UI do portal)
        taxes: (of.fair.taxes ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          percentBps: t.percentBps,
          isActive: t.isActive,
        })),
      };
    });

    return { items };
  }

  // ---------------------------------------------
  // Link stall
  // - consome UMA purchase
  // - purchaseId pode vir opcional; se não vier, escolhe automaticamente
  // ---------------------------------------------
  /**
   * Vincula uma barraca do expositor a uma feira.
   *
   * Regras:
   * - Expositor precisa ter OwnerFair nesta feira
   * - A barraca precisa ser do owner logado
   * - Precisa existir compra compatível por tamanho (stallSize)
   * - Não pode exceder o total comprado (controle via usedQty/qty)
   * - Cada StallFair consome exatamente 1 unidade de 1 OwnerFairPurchase
   */
  async linkStallToFairByMe(
    userId: string,
    fairId: string,
    stallId: string,
    purchaseId?: string,
  ): Promise<LinkStallResponseDto> {
    const ownerId = await this.getOwnerIdOrThrow(userId);

    const ownerFair = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId } },
      select: { id: true, stallsQty: true },
    });
    if (!ownerFair)
      throw new BadRequestException('Você não está vinculado a esta feira.');

    const stall = await this.prisma.stall.findFirst({
      where: { id: stallId, ownerId },
      select: { id: true, stallSize: true },
    });
    if (!stall) throw new NotFoundException('Barraca não encontrada.');

    if (ownerFair.stallsQty <= 0) {
      throw new BadRequestException(
        'Você não possui barracas compradas/reservadas nesta feira.',
      );
    }

    // Guard-rail por UX/performance: não deixar ultrapassar "stallsQty" do OwnerFair
    const linkedTotalQty = await this.prisma.stallFair.count({
      where: { ownerFairId: ownerFair.id },
    });
    if (linkedTotalQty >= ownerFair.stallsQty) {
      throw new BadRequestException(
        'Você já vinculou todas as barracas compradas nesta feira.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Já vinculou esta barraca nesta feira?
      const existing = await tx.stallFair.findUnique({
        where: { stallId_fairId: { stallId, fairId } },
        select: { id: true },
      });
      if (existing)
        throw new BadRequestException(
          'Esta barraca já está vinculada nesta feira.',
        );

      // ✅ Escolha da purchase disponível (mesmo tamanho)
      let chosen: {
        id: string;
        ownerFairId: string;
        stallSize: StallSize;
        qty: number;
        usedQty: number;
      } | null = null;

      if (purchaseId) {
        // Compra explicitamente escolhida pelo portal
        const p = await tx.ownerFairPurchase.findUnique({
          where: { id: purchaseId },
          select: {
            id: true,
            ownerFairId: true,
            stallSize: true,
            qty: true,
            usedQty: true,
          },
        });
        if (!p)
          throw new NotFoundException('Compra (purchaseId) não encontrada.');

        if (p.ownerFairId !== ownerFair.id) {
          throw new BadRequestException(
            'purchaseId não pertence a esta feira/expositor.',
          );
        }

        if (p.stallSize !== (stall.stallSize as StallSize)) {
          throw new BadRequestException(
            'purchaseId não é compatível com o tamanho desta barraca.',
          );
        }

        if ((p.usedQty ?? 0) >= (p.qty ?? 0)) {
          throw new BadRequestException(
            'Esta compra não possui vagas disponíveis (usedQty >= qty).',
          );
        }

        chosen = p;
      } else {
        // Auto-seleção: primeira compra disponível (mais antiga) do mesmo tamanho
        const all = await tx.ownerFairPurchase.findMany({
          where: {
            ownerFairId: ownerFair.id,
            stallSize: stall.stallSize as any,
          },
          select: {
            id: true,
            ownerFairId: true,
            stallSize: true,
            qty: true,
            usedQty: true,
          },
          orderBy: { createdAt: 'asc' },
        });

        chosen = all.find((x) => (x.usedQty ?? 0) < (x.qty ?? 0)) ?? null;

        if (!chosen) {
          throw new BadRequestException(
            'Você não possui compras disponíveis para este tamanho de barraca (ou todas já foram consumidas).',
          );
        }
      }

      // Cria o vínculo real e consome 1 unidade da compra
      await tx.stallFair.create({
        data: {
          fairId,
          stallId,
          ownerFairId: ownerFair.id,
          purchaseId: chosen.id,
        },
        select: { id: true },
      });

      await tx.ownerFairPurchase.update({
        where: { id: chosen.id },
        data: { usedQty: { increment: 1 } },
      });

      return { ok: true };
    });
  }

  // ---------------------------------------------
  // Unlink stall
  // - remove StallFair
  // - decrementa usedQty da purchase consumida
  // ---------------------------------------------
  /**
   * Desvincula uma barraca de uma feira.
   *
   * Regras:
   * - Só pode desvincular se o StallFair pertencer ao OwnerFair do usuário
   * - Ao remover, devolve 1 unidade (usedQty--) da purchase consumida
   */
  async unlinkStallFromFairByMe(
    userId: string,
    fairId: string,
    stallId: string,
  ): Promise<UnlinkStallResponseDto> {
    const ownerId = await this.getOwnerIdOrThrow(userId);

    const ownerFair = await this.prisma.ownerFair.findUnique({
      where: { ownerId_fairId: { ownerId, fairId } },
      select: { id: true },
    });
    if (!ownerFair)
      throw new BadRequestException('Você não está vinculado a esta feira.');

    const stall = await this.prisma.stall.findFirst({
      where: { id: stallId, ownerId },
      select: { id: true },
    });
    if (!stall) throw new NotFoundException('Barraca não encontrada.');

    return this.prisma.$transaction(async (tx) => {
      const found = await tx.stallFair.findUnique({
        where: { stallId_fairId: { stallId, fairId } },
        select: { id: true, ownerFairId: true, purchaseId: true },
      });
      if (!found)
        throw new NotFoundException(
          'Vínculo desta barraca com a feira não encontrado.',
        );

      if (found.ownerFairId !== ownerFair.id) {
        throw new BadRequestException(
          'Você não tem permissão para desvincular esta barraca desta feira.',
        );
      }

      await tx.stallFair.delete({ where: { id: found.id } });

      const p = await tx.ownerFairPurchase.findUnique({
        where: { id: found.purchaseId },
        select: { id: true, usedQty: true },
      });

      if (p) {
        const used = p.usedQty ?? 0;
        if (used > 0) {
          await tx.ownerFairPurchase.update({
            where: { id: p.id },
            data: { usedQty: { decrement: 1 } },
          });
        }
      }

      return { ok: true };
    });
  }
}
