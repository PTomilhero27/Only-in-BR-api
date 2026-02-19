import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExcelDataset, ExcelTemplateStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ExcelGeneratorService } from '../../excel/excel-generator.service';
import { ExcelContext } from '../../excel/types/excel-context.type';
import { ExcelDatasetsService } from '../excel-datasets/excel-datasets.service';
import { CreateExcelExportDto } from './dto/create-excel-export.dto';

/**
 * ✅ ExcelExportsService
 *
 * Responsabilidade:
 * - Carregar template (sheets/cells/tables/columns)
 * - Carregar dados do banco conforme scope
 * - Montar ctx.root + ctx.lists
 * - Delegar pro ExcelGeneratorService
 *
 * MVP atual:
 * - Tudo é "por feira", então scope.fairId é obrigatório
 * - ownerId é opcional: exporta apenas 1 expositor dentro da feira
 */
@Injectable()
export class ExcelExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelGenerator: ExcelGeneratorService,
    private readonly excelDatasets: ExcelDatasetsService, // ✅ registry oficial
  ) {}

  async generate(dto: CreateExcelExportDto): Promise<{
    filename: string;
    buffer: Buffer;
  }> {
    const { templateId, scope } = dto;
    const { fairId, ownerId } = scope;

    if (!fairId) {
      throw new BadRequestException('scope.fairId é obrigatório no MVP.');
    }

    // 1) Template completo
    const template = await this.prisma.excelTemplate.findUnique({
      where: { id: templateId },
      include: {
        sheets: {
          orderBy: { order: 'asc' },
          include: {
            cells: { orderBy: [{ row: 'asc' }, { col: 'asc' }] },
            tables: {
              orderBy: [{ anchorRow: 'asc' }, { anchorCol: 'asc' }],
              include: { columns: { orderBy: { order: 'asc' } } },
            },
          },
        },
      },
    });

    if (!template) throw new NotFoundException('Template não encontrado.');
    if (template.status !== ExcelTemplateStatus.ACTIVE) {
      throw new BadRequestException(
        'Template está INATIVO e não pode ser exportado.',
      );
    }

    // 2) Feira base
    const fair = await this.prisma.fair.findUnique({
      where: { id: fairId },
      select: {
        id: true,
        name: true,
        status: true,
        address: true,
        stallsCapacity: true,
      },
    });

    if (!fair) throw new NotFoundException('Feira não encontrada.');

    // 3) Expositores (OwnerFair + Owner + Purchases + Installments)
    const ownerFairs = await this.prisma.ownerFair.findMany({
      where: {
        fairId,
        ...(ownerId ? { ownerId } : {}),
      },
      include: {
        owner: true,
        ownerFairPurchases: {
          include: { installments: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 4) Barracas da feira (StallFair + Stall + OwnerFair + Owner + Purchase)
    const stallFairs = await this.prisma.stallFair.findMany({
      where: {
        fairId,
        ...(ownerId ? { ownerFair: { ownerId } } : {}),
      },
      include: {
        stall: true,
        ownerFair: { include: { owner: true } },
        purchase: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 5) Monta ctx (root + lists)

    // ✅ Reservadas = soma de stallsQty (quantidade comprada/reservada por expositor)
    const stallsReserved = ownerFairs.reduce(
      (acc, of) => acc + (of.stallsQty ?? 0),
      0,
    );

    // ✅ Vinculadas = quantidade real de StallFair criadas
    const stallsLinked = stallFairs.length;

    // ✅ Disponíveis (pela semântica "reservadas/disponíveis") = capacity - reserved
    const stallsRemaining = Math.max(0, fair.stallsCapacity - stallsReserved);

    const ctx: ExcelContext = {
      root: {
        fair: {
          id: fair.id,
          name: fair.name,
          status: fair.status,
          address: fair.address,
          stallsCapacity: fair.stallsCapacity,
          stallsReserved,
          stallsRemaining,
          // opcional se você quiser usar em templates:
          stallsLinked,
        },
        generatedAt: new Date(),
      },
      lists: {
        // ✅ Enum correto do seu Prisma: FAIR_EXHIBITORS_LIST
        [ExcelDataset.FAIR_EXHIBITORS_LIST]: ownerFairs.map((of) => {
          const totalCents = of.ownerFairPurchases.reduce(
            (acc, p) => acc + p.totalCents,
            0,
          );

          const paidCents = of.ownerFairPurchases.reduce(
            (acc, p) => acc + p.paidCents,
            0,
          );

          const paymentStatus =
            totalCents === 0
              ? 'N/A'
              : paidCents >= totalCents
                ? 'PAID'
                : paidCents > 0
                  ? 'PARTIALLY_PAID'
                  : 'PENDING';

          return {
            owner: {
              id: of.owner.id,
              fullName: of.owner.fullName,
              document: of.owner.document,
              email: of.owner.email,
              phone: of.owner.phone,
            },
            ownerFair: {
              status: of.status,
              stallsQty: of.stallsQty, // ✅ útil no Excel
              contractSignedAt: of.contractSignedAt, // ✅ existe no Prisma
              observations: of.observations,
            },
            // ✅ seu catálogo novo recomenda "financial.*"
            financial: {
              status: paymentStatus,
              totalCents,
              paidCents,
              pendingCents: Math.max(0, totalCents - paidCents),
            },
          };
        }),

        // ✅ Enum correto do seu Prisma: FAIR_STALLS_LIST
        [ExcelDataset.FAIR_STALLS_LIST]: stallFairs.map((sf) => ({
          stall: {
            id: sf.stall.id,
            pdvName: sf.stall.pdvName,
            bannerName: sf.stall.bannerName,
            mainCategory: sf.stall.mainCategory,
            stallType: sf.stall.stallType,
            stallSize: sf.stall.stallSize,
            machinesQty: sf.stall.machinesQty,
            teamQty: sf.stall.teamQty,

            // ⚠️ needsGas não existe direto no Stall no Prisma.
            // Se você quiser, inclua powerNeed no include do stallFair (stall: { include: { powerNeed: true } })
            // e monte aqui como powerNeed.needsGas.
          },
          owner: {
            id: sf.ownerFair.owner.id,
            fullName: sf.ownerFair.owner.fullName,
            document: sf.ownerFair.owner.document,
          },
          purchase: {
            id: sf.purchase.id,
            totalCents: sf.purchase.totalCents,
            paidCents: sf.purchase.paidCents,
            status: sf.purchase.status,
          },
          // opcional se quiser usar no Excel:
          stallFair: {
            id: sf.id,
            createdAt: sf.createdAt,
          },
        })),
      },
    };

    // 6) Gera buffer
    const buffer = await this.excelGenerator.generateXlsxBuffer({
      template,
      ctx,
      registry: this.excelDatasets,
    });

    const safeName = fair.name.replace(/[^\w\d-]+/g, '-').slice(0, 40);
    const filename = ownerId
      ? `export-${safeName}-owner.xlsx`
      : `export-${safeName}.xlsx`;

    return { filename, buffer };
  }
}
