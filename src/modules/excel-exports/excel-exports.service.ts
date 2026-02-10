import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExcelDataset, ExcelTemplateStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ExcelGeneratorService } from '../../excel/excel-generator.service';
import { ExcelContext } from '../../excel/types/excel-context.type';

import { ExcelDatasetsService } from '../excel-datasets/excel-datasets.service';
import { CreateExcelExportDto } from './dto/create-excel-export.dto';

/**
 * ✅ ExcelExportsService
 *
 * Este service centraliza a regra de negócio de exportação:
 * - Carregar o template (com sheets/cells/tables/columns)
 * - Carregar os dados do banco (fair + expositores + barracas)
 * - Montar o contexto do gerador (ctx.root + ctx.lists)
 * - Delegar a geração para o ExcelGeneratorService (core)
 */
@Injectable()
export class ExcelExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelGenerator: ExcelGeneratorService,
    private readonly excelDatasets: ExcelDatasetsService, // ✅ registry oficial
  ) {}

  /**
   * Gera o arquivo .xlsx em memória (Buffer).
   * O controller será responsável por stream/download.
   */
  async generate(dto: CreateExcelExportDto): Promise<{
    filename: string;
    buffer: Buffer;
  }> {
    // 1) Carrega template completo
    const template = await this.prisma.excelTemplate.findUnique({
      where: { id: dto.templateId },
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
      throw new BadRequestException('Template está INATIVO e não pode ser exportado.');
    }

    // 2) Carrega feira (inclui contagens simples)
    const fair = await this.prisma.fair.findUnique({
      where: { id: dto.fairId },
      select: {
        id: true,
        name: true,
        status: true,
        address: true,
        stallsCapacity: true,
        ownerFairs: { select: { id: true } },
        stallFairs: { select: { id: true } },
      },
    });

    if (!fair) throw new NotFoundException('Feira não encontrada.');

    // 3) Expositores da feira (OwnerFair + Owner + Purchases)
    const ownerFairs = await this.prisma.ownerFair.findMany({
      where: {
        fairId: dto.fairId,
        ...(dto.ownerId ? { ownerId: dto.ownerId } : {}),
      },
      include: {
        owner: true,
        ownerFairPurchases: {
          include: { installments: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 4) Barracas vinculadas na feira (StallFair + Stall + OwnerFair + Owner + Purchase)
    const stallFairs = await this.prisma.stallFair.findMany({
      where: {
        fairId: dto.fairId,
        ...(dto.ownerId ? { ownerFair: { ownerId: dto.ownerId } } : {}),
      },
      include: {
        stall: true,
        ownerFair: { include: { owner: true } },
        purchase: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 5) Monta contexto do Excel (root + lists)
    // MVP: reservadas = quantidade de vínculos OwnerFair (pode evoluir para soma de stallsQty)
    const stallsReserved = fair.ownerFairs.length;
    const stallsLinked = fair.stallFairs.length;
    const stallsRemaining = Math.max(0, fair.stallsCapacity - stallsLinked);

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
        },
        generatedAt: new Date(),
      },
      lists: {
        [ExcelDataset.FAIR_EXHIBITORS]: ownerFairs.map((of) => {
          const totalCents = of.ownerFairPurchases.reduce((acc, p) => acc + p.totalCents, 0);
          const paidCents = of.ownerFairPurchases.reduce((acc, p) => acc + p.paidCents, 0);

          // MVP: status simples do pagamento
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
              observations: of.observations,
            },
            payment: {
              status: paymentStatus,
              totalCents,
              paidCents,
            },
          };
        }),

        [ExcelDataset.FAIR_STALLS]: stallFairs.map((sf) => ({
          stall: {
            id: sf.stall.id,
            pdvName: sf.stall.pdvName,
            stallType: sf.stall.stallType,
            stallSize: sf.stall.stallSize,
            machinesQty: sf.stall.machinesQty,
            teamQty: sf.stall.teamQty,
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
        })),
      },
    };

    // 6) Delega ao core (✅ assinatura correta: 1 argumento com params)
    const buffer = await this.excelGenerator.generateXlsxBuffer({
      template: template as any,
      ctx,
      registry: this.excelDatasets,
    });

    const safeName = fair.name.replace(/[^\w\d-]+/g, '-').slice(0, 40);
    const filename = dto.ownerId ? `export-${safeName}-owner.xlsx` : `export-${safeName}.xlsx`;

    return { filename, buffer };
  }
}
