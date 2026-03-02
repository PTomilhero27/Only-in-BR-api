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
 * Observação importante (novidade):
 * - Para exportar "Cardápio (Produtos)" em formato de tabela (1 linha por produto),
 *   precisamos de um dataset MULTI "flatten" por feira:
 *   ✅ ExcelDataset.FAIR_MENU_PRODUCTS_LIST
 *
 * Requisitos para funcionar:
 * - Enum ExcelDataset no Prisma DEVE incluir FAIR_MENU_PRODUCTS_LIST
 * - O registry (buildExcelDatasetDefinitions) DEVE expor os fields:
 *   stall.pdvName, owner.fullName, category.name, product.name, product.priceCents
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

    // ✅ MVP: sempre por feira
    if (!fairId) {
      throw new BadRequestException('scope.fairId é obrigatório no MVP.');
    }

    /**
     * 1) Carrega o template completo (abas + cells + tables + columns)
     * - O generator depende desse shape para renderizar o workbook.
     */
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

    /**
     * 2) Carrega a feira base (root.fair.*)
     * - Mantemos select enxuto por performance.
     */
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

    /**
     * 3) Expositores (OwnerFair + Owner + Purchases + Installments)
     * - Esta lista alimenta FAIR_EXHIBITORS_LIST
     */
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

    /**
     * 4) Barracas da feira (StallFair + Stall + Owner + Purchase)
     * - Esta lista alimenta:
     *   - FAIR_STALLS_LIST (lista de barracas)
     *   - FAIR_MENU_PRODUCTS_LIST (lista flatten de produtos do cardápio)
     *
     * ✅ Importante:
     * - Precisamos incluir menuCategories/products para gerar a planilha de cardápio.
     * - Mantemos orderBy para export previsível.
     */
    const stallFairs = await this.prisma.stallFair.findMany({
      where: {
        fairId,
        ...(ownerId ? { ownerFair: { ownerId } } : {}),
      },
      include: {
        stall: {
          include: {
            // ✅ Cardápio
            menuCategories: {
              orderBy: { order: 'asc' },
              include: {
                products: { orderBy: { order: 'asc' } },
              },
            },

            // ⚠️ Se você quiser exportar infra:
            // powerNeed: true,
          },
        },
        ownerFair: { include: { owner: true } },
        purchase: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    /**
     * 5) KPIs básicos (root.fair.*)
     * - Reservadas: soma de OwnerFair.stallsQty
     * - Vinculadas: StallFair reais
     * - Disponíveis: capacity - reserved
     */
    const stallsReserved = ownerFairs.reduce(
      (acc, of) => acc + (of.stallsQty ?? 0),
      0,
    );
    const stallsLinked = stallFairs.length;
    const stallsRemaining = Math.max(0, fair.stallsCapacity - stallsReserved);

    /**
     * 6) Monta o ctx consumido pelo ExcelGeneratorService
     * - root: dados únicos para binds SINGLE (ex.: fair.name)
     * - lists: dados MULTI (tabelas/listas)
     *
     * Observação:
     * - Mesmo que um template use somente um dataset, é ok preencher outros.
     * - O generator simplesmente ignora o que não for usado.
     */
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
          stallsLinked,
        },
        generatedAt: new Date(),
      },
      lists: {
        /**
         * ✅ FAIR_EXHIBITORS_LIST
         * - Retorna uma linha por expositor (OwnerFair)
         * - Calcula resumo financeiro via purchases
         */
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
              stallsQty: of.stallsQty,
              contractSignedAt: of.contractSignedAt,
              observations: of.observations,
            },
            financial: {
              status: paymentStatus,
              totalCents,
              paidCents,
              pendingCents: Math.max(0, totalCents - paidCents),
            },
          };
        }),

        /**
         * ✅ FAIR_STALLS_LIST
         * - Retorna uma linha por barraca vinculada na feira (StallFair)
         * - Observação: aqui NÃO “explode” cardápio. É “lista de barracas”.
         */
        [ExcelDataset.FAIR_STALLS_LIST]: stallFairs.map((sf) => {
          // ✅ Resumos do cardápio (ajuda em relatórios sem precisar explodir produtos)
          const menuCategoriesCount = sf.stall.menuCategories?.length ?? 0;
          const menuProductsCount =
            sf.stall.menuCategories?.reduce(
              (acc, c) => acc + (c.products?.length ?? 0),
              0,
            ) ?? 0;

          const menuSummaryText =
            menuCategoriesCount === 0
              ? ''
              : (sf.stall.menuCategories ?? [])
                  .map((c) => `${c.name}: ${c.products?.length ?? 0}`)
                  .join(' | ');

          return {
            stall: {
              id: sf.stall.id,
              pdvName: sf.stall.pdvName,
              bannerName: sf.stall.bannerName,
              mainCategory: sf.stall.mainCategory,
              stallType: sf.stall.stallType,
              stallSize: sf.stall.stallSize,
              machinesQty: sf.stall.machinesQty,
              teamQty: sf.stall.teamQty,

              // ✅ Cardápio (resumo)
              menuCategoriesCount,
              menuProductsCount,
              menuSummaryText,

              // ⚠️ Infra exemplo (se incluir powerNeed):
              // powerNeed: { needsGas: sf.stall.powerNeed?.needsGas ?? false },
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

            stallFair: {
              id: sf.id,
              createdAt: sf.createdAt,
            },
          };
        }),

        /**
         * ✅ FAIR_MENU_PRODUCTS_LIST (NOVO)
         *
         * Objetivo:
         * - Gerar 1 linha por produto do cardápio,
         *   incluindo PDV da barraca + nome do dono.
         *
         * Isso atende a planilha:
         * - PDV | Nome do produto | Preço | Dono
         *
         * Importante:
         * - Só entram produtos de barracas efetivamente vinculadas na feira (StallFair).
         * - Se uma barraca não tem cardápio, ela não gera linhas.
         */
        [ExcelDataset.FAIR_MENU_PRODUCTS_LIST]: stallFairs.flatMap((sf) => {
          const owner = sf.ownerFair.owner;

          const categories = sf.stall.menuCategories ?? [];
          if (categories.length === 0) return [];

          return categories.flatMap((cat) => {
            const products = cat.products ?? [];
            if (products.length === 0) return [];

            return products.map((prod) => ({
              stall: {
                id: sf.stall.id,
                pdvName: sf.stall.pdvName,
              },
              owner: {
                id: owner.id,
                fullName: owner.fullName ?? '',
              },
              category: {
                id: cat.id,
                name: cat.name,
                order: cat.order,
              },
              product: {
                id: prod.id,
                name: prod.name,
                priceCents: prod.priceCents,
                order: prod.order,
              },
            }));
          });
        }),
      },
    };

    /**
     * 7) Gera o buffer do XLSX (ExcelJS por baixo)
     * - O generator recebe: template + ctx + registry (catálogo de binds)
     */
    const buffer = await this.excelGenerator.generateXlsxBuffer({
      template,
      ctx,
      registry: this.excelDatasets,
    });

    /**
     * 8) Nome do arquivo
     * - Sanitiza para evitar caracteres inválidos em Windows.
     */
    const safeName = fair.name.replace(/[^\w\d-]+/g, '-').slice(0, 40);
    const filename = ownerId
      ? `export-${safeName}-owner.xlsx`
      : `export-${safeName}.xlsx`;

    return { filename, buffer };
  }
}
