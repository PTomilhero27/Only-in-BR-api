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
 * Esta service é responsável por:
 * - Carregar o template de exportação do Excel
 * - Buscar os dados necessários no banco
 * - Montar o contexto consumido pelo gerador
 * - Delegar a geração do arquivo XLSX para o ExcelGeneratorService
 *
 * Observação:
 * - Apesar do fluxo "baixar arquivo" acontecer no front/controller,
 *   esta service apenas gera o buffer + filename do Excel.
 * - Aqui adicionamos também os dados de infraestrutura da barraca
 *   (equipamentos, tomadas, gás e observações operacionais).
 */
@Injectable()
export class ExcelExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelGenerator: ExcelGeneratorService,
    private readonly excelDatasets: ExcelDatasetsService,
  ) {}

  /**
   * Gera o arquivo XLSX com base no template e no escopo informado.
   *
   * Responsabilidades:
   * - Validar escopo mínimo
   * - Carregar dados da feira
   * - Carregar expositores e barracas vinculadas
   * - Montar datasets SINGLE e MULTI
   * - Retornar buffer + nome do arquivo
   */
  async generate(dto: CreateExcelExportDto): Promise<{
    filename: string;
    buffer: Buffer;
  }> {
    const { templateId, scope } = dto;
    const { fairId, ownerId } = scope;

    // No MVP atual, toda exportação depende de uma feira.
    if (!fairId) {
      throw new BadRequestException('scope.fairId é obrigatório no MVP.');
    }

    /**
     * 1) Carrega o template completo
     *
     * O gerador precisa receber:
     * - abas
     * - células fixas
     * - tabelas
     * - colunas das tabelas
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

    if (!template) {
      throw new NotFoundException('Template não encontrado.');
    }

    if (template.status !== ExcelTemplateStatus.ACTIVE) {
      throw new BadRequestException(
        'Template está INATIVO e não pode ser exportado.',
      );
    }

    /**
     * 2) Carrega a feira base
     *
     * Mantemos o select enxuto porque os dados derivados
     * serão calculados aqui na própria service.
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

    if (!fair) {
      throw new NotFoundException('Feira não encontrada.');
    }

    /**
     * 3) Carrega os expositores vinculados à feira
     *
     * Esta estrutura alimenta principalmente o dataset:
     * - FAIR_EXHIBITORS_LIST
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
     * 4) Carrega as barracas vinculadas à feira
     *
     * Esta estrutura alimenta:
     * - FAIR_STALLS_LIST
     * - FAIR_MENU_PRODUCTS_LIST
     *
     * Importante:
     * - Incluímos menuCategories/products para exportar cardápio
     * - Incluímos powerNeed e equipments para exportar infraestrutura
     */
    const stallFairs = await this.prisma.stallFair.findMany({
      where: {
        fairId,
        ...(ownerId ? { ownerFair: { ownerId } } : {}),
      },
      include: {
        stall: {
          include: {
            /**
             * Cardápio da barraca
             */
            menuCategories: {
              orderBy: { order: 'asc' },
              include: {
                products: { orderBy: { order: 'asc' } },
              },
            },

            /**
             * Infraestrutura elétrica/gás da barraca
             */
            powerNeed: true,

            /**
             * Equipamentos informados pela barraca
             */
            equipments: {
              orderBy: { name: 'asc' },
            },
          },
        },
        ownerFair: { include: { owner: true } },
        purchase: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    /**
     * 5) KPIs básicos da feira
     *
     * Reservadas: soma do que foi comprado/reservado
     * Vinculadas: barracas já efetivamente ligadas na feira
     * Disponíveis: capacidade restante
     */
    const stallsReserved = ownerFairs.reduce(
      (acc, of) => acc + (of.stallsQty ?? 0),
      0,
    );
    const stallsLinked = stallFairs.length;
    const stallsRemaining = Math.max(0, fair.stallsCapacity - stallsReserved);

    /**
     * Helper interno para transformar a lista de equipamentos
     * em um texto legível na exportação.
     *
     * Exemplo:
     * "Freezer x2, Chapa x1, Fritadeira x1"
     */
    const buildEquipmentsSummaryText = (
      equipments: Array<{ name: string; qty: number }>,
    ): string => {
      if (!equipments.length) return '';

      return equipments.map((item) => `${item.name} x${item.qty}`).join(', ');
    };

    /**
     * 6) Monta o contexto consumido pelo ExcelGeneratorService
     *
     * Estrutura:
     * - root  => binds únicos (SINGLE)
     * - lists => tabelas/listas (MULTI)
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
         *
         * Retorna uma linha por expositor vinculado à feira.
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
         *
         * Retorna uma linha por barraca vinculada na feira.
         *
         * Além dos dados básicos da barraca, agora também levamos:
         * - resumo do cardápio
         * - infraestrutura elétrica/gás
         * - resumo de equipamentos
         */
        [ExcelDataset.FAIR_STALLS_LIST]: stallFairs.map((sf) => {
          const menuCategoriesCount = sf.stall.menuCategories?.length ?? 0;
          const menuProductsCount =
            sf.stall.menuCategories?.reduce(
              (acc, category) => acc + (category.products?.length ?? 0),
              0,
            ) ?? 0;

          const menuSummaryText =
            menuCategoriesCount === 0
              ? ''
              : (sf.stall.menuCategories ?? [])
                  .map(
                    (category) =>
                      `${category.name}: ${category.products?.length ?? 0}`,
                  )
                  .join(' | ');

          const equipments = sf.stall.equipments ?? [];
          const equipmentsCount = equipments.length;
          const equipmentsTotalQty = equipments.reduce(
            (acc, item) => acc + (item.qty ?? 0),
            0,
          );
          const equipmentsSummaryText = buildEquipmentsSummaryText(equipments);

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

              /**
               * Resumo do cardápio
               */
              menuCategoriesCount,
              menuProductsCount,
              menuSummaryText,

              /**
               * Resumo dos equipamentos
               */
              equipmentsCount,
              equipmentsTotalQty,
              equipmentsSummaryText,
            },

            /**
             * Infraestrutura elétrica e operacional
             *
             * Mantemos separado em powerNeed para o catálogo de fields
             * continuar previsível e sem contratos implícitos.
             */
            powerNeed: {
              outlets110: sf.stall.powerNeed?.outlets110 ?? 0,
              outlets220: sf.stall.powerNeed?.outlets220 ?? 0,
              outletsOther: sf.stall.powerNeed?.outletsOther ?? 0,
              needsGas: sf.stall.powerNeed?.needsGas ?? false,
              gasNotes: sf.stall.powerNeed?.gasNotes ?? '',
              notes: sf.stall.powerNeed?.notes ?? '',
            },

            owner: {
              id: sf.ownerFair.owner.id,
              fullName: sf.ownerFair.owner.fullName,
              document: sf.ownerFair.owner.document,
              email: sf.ownerFair.owner.email,
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
         * ✅ OWNER_STALLS_LIST
         *
         * Retorna uma linha por barraca do expositor.
         */
        [ExcelDataset.OWNER_STALLS_LIST]: stallFairs.map((sf) => {
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
            },
            powerNeed: {
              needsGas: sf.stall.powerNeed?.needsGas ?? false,
            },
            owner: {
              id: sf.ownerFair.owner.id,
              fullName: sf.ownerFair.owner.fullName,
              document: sf.ownerFair.owner.document,
              email: sf.ownerFair.owner.email,
            },
          };
        }),

        /**
         * ✅ FAIR_MENU_PRODUCTS_LIST
         *
         * Retorna uma linha por produto do cardápio,
         * considerando apenas barracas efetivamente vinculadas à feira.
         */
        [ExcelDataset.FAIR_MENU_PRODUCTS_LIST]: stallFairs.flatMap((sf) => {
          const owner = sf.ownerFair.owner;
          const categories = sf.stall.menuCategories ?? [];

          if (categories.length === 0) {
            return [];
          }

          return categories.flatMap((category) => {
            const products = category.products ?? [];

            if (products.length === 0) {
              return [];
            }

            return products.map((product) => ({
              stall: {
                id: sf.stall.id,
                pdvName: sf.stall.pdvName,
              },
              owner: {
                id: owner.id,
                fullName: owner.fullName ?? '',
              },
              category: {
                id: category.id,
                name: category.name,
                order: category.order,
              },
              product: {
                id: product.id,
                name: product.name,
                priceCents: product.priceCents,
                order: product.order,
              },
            }));
          });
        }),
      },
    };

    /**
     * 7) Gera o buffer do arquivo XLSX
     *
     * O ExcelGeneratorService recebe:
     * - template
     * - contexto com os dados
     * - registry oficial com os binds disponíveis
     */
    const buffer = await this.excelGenerator.generateXlsxBuffer({
      template,
      ctx,
      registry: this.excelDatasets,
    });

    /**
     * 8) Monta nome seguro do arquivo
     *
     * Sanitizamos o nome da feira para evitar caracteres inválidos.
     */
    const safeName = fair.name.replace(/[^\w\d-]+/g, '-').slice(0, 40);
    const filename = ownerId
      ? `export-${safeName}-owner.xlsx`
      : `export-${safeName}.xlsx`;

    return { filename, buffer };
  }
}
