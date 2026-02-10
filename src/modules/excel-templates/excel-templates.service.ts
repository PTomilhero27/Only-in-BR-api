import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExcelCellType, ExcelTemplateStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ExcelDatasetsService } from '../excel-datasets/excel-datasets.service';

import { CreateExcelTemplateDto } from './dto/create-excel-template.dto';
import { UpdateExcelTemplateDto } from './dto/update-excel-template.dto';
import { ExcelTemplateListItemDto } from './dto/excel-template-list-item.dto';
import { ExcelTemplateResponseDto } from './dto/excel-template-response.dto';

/**
 * ✅ ExcelTemplatesService
 *
 * Este service centraliza a regra de negócio de:
 * - CRUD de templates de Excel (designer)
 * - Validações estruturais (fieldKey, colisões básicas)
 *
 * Observação:
 * - MVP: PATCH funciona como "replace" do conteúdo do template (sheets/cells/tables).
 * - Isso reduz complexidade e evita inconsistências.
 */
@Injectable()
export class ExcelTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelDatasets: ExcelDatasetsService,
  ) {}

  /**
   * Lista templates (visão enxuta).
   */
  async list(): Promise<ExcelTemplateListItemDto[]> {
    const items = await this.prisma.excelTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return items;
  }

  /**
   * Retorna um template completo (inclui sheets/cells/tables/columns).
   */
  async getById(id: string): Promise<ExcelTemplateResponseDto> {
    const tpl = await this.prisma.excelTemplate.findUnique({
      where: { id },
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

    if (!tpl) throw new NotFoundException('Template não encontrado.');

    return tpl as any;
  }

  /**
   * Cria template com validação completa do payload.
   */
  async create(dto: CreateExcelTemplateDto): Promise<ExcelTemplateResponseDto> {
    this.validateTemplatePayload(dto);

    const created = await this.prisma.excelTemplate.create({
      data: {
        name: dto.name,
        status: dto.status ?? ExcelTemplateStatus.ACTIVE,
        sheets: {
          create: (dto.sheets ?? []).map((s) => ({
            name: s.name,
            order: s.order ?? 0,
            dataset: s.dataset,
            cells: {
              create: (s.cells ?? []).map((c) => ({
                row: c.row,
                col: c.col,
                type: c.type,
                value: c.value,
                format: c.format ?? null,
                bold: c.bold ?? false,
              })),
            },
            tables: {
              create: (s.tables ?? []).map((t) => ({
                anchorRow: t.anchorRow,
                anchorCol: t.anchorCol,
                dataset: t.dataset,
                includeHeader: t.includeHeader ?? true,
                columns: {
                  create: (t.columns ?? []).map((col, idx) => ({
                    order: col.order ?? idx,
                    header: col.header,
                    fieldKey: col.fieldKey,
                    format: col.format ?? null,
                    width: col.width ?? null,
                  })),
                },
              })),
            },
          })),
        },
      },
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

    return created as any;
  }

  /**
   * Atualiza template.
   *
   * Estratégia MVP:
   * - Atualiza meta (name/status) se vier
   * - Se vier "sheets", faz replace total (delete + create)
   */
  async update(id: string, dto: UpdateExcelTemplateDto): Promise<ExcelTemplateResponseDto> {
    const existing = await this.prisma.excelTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Template não encontrado.');

    // Se vier estrutura (sheets), validamos como template completo.
    if (dto.sheets) {
      this.validateTemplatePayload({
        name: dto.name ?? 'template',
        status: dto.status,
        sheets: dto.sheets as any,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1) Atualiza meta
      await tx.excelTemplate.update({
        where: { id },
        data: {
          name: dto.name,
          status: dto.status,
        },
      });

      // 2) Replace estrutural (se aplicável)
      if (dto.sheets) {
        // Apaga sheets (e por cascade apaga cells/tables/columns)
        await tx.excelTemplateSheet.deleteMany({ where: { templateId: id } });

        // Recria sheets
        await tx.excelTemplateSheet.createMany({
          data: (dto.sheets ?? []).map((s) => ({
            templateId: id,
            name: s.name,
            order: s.order ?? 0,
            dataset: s.dataset,
          })),
        });

        // Como usamos createMany acima, precisamos buscar ids das sheets recém-criadas.
        // Para manter o MVP simples e consistente, vamos recriar tudo via tx.excelTemplate.update com nested create.
        // Portanto, desfazemos a abordagem createMany e partimos pra nested update total abaixo.
        // (Atenção: este bloco é mantido como referência de intenção; o fluxo real está logo abaixo.)
        // eslint-disable-next-line no-constant-condition
        if (true) {
          // Reaplica: remove e cria de forma aninhada (mais simples e consistente)
          await tx.excelTemplateSheet.deleteMany({ where: { templateId: id } });

          await tx.excelTemplate.update({
            where: { id },
            data: {
              sheets: {
                create: (dto.sheets ?? []).map((s) => ({
                  name: s.name,
                  order: s.order ?? 0,
                  dataset: s.dataset,
                  cells: {
                    create: (s.cells ?? []).map((c) => ({
                      row: c.row,
                      col: c.col,
                      type: c.type,
                      value: c.value,
                      format: c.format ?? null,
                      bold: c.bold ?? false,
                    })),
                  },
                  tables: {
                    create: (s.tables ?? []).map((t) => ({
                      anchorRow: t.anchorRow,
                      anchorCol: t.anchorCol,
                      dataset: t.dataset,
                      includeHeader: t.includeHeader ?? true,
                      columns: {
                        create: (t.columns ?? []).map((col, idx) => ({
                          order: col.order ?? idx,
                          header: col.header,
                          fieldKey: col.fieldKey,
                          format: col.format ?? null,
                          width: col.width ?? null,
                        })),
                      },
                    })),
                  },
                })),
              },
            },
          });
        }
      }

      // Retorna completo
      return tx.excelTemplate.findUnique({
        where: { id },
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
    });

    if (!updated) throw new NotFoundException('Template não encontrado.');
    return updated as any;
  }

  /**
   * Remove template.
   */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.excelTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Template não encontrado.');

    await this.prisma.excelTemplate.delete({ where: { id } });
  }

  // =========================
  // Validações (MVP)
  // =========================

  /**
   * Valida o payload do template antes de persistir.
   * Aqui evitamos templates "impossíveis" e problemas no gerador.
   */
  private validateTemplatePayload(dto: CreateExcelTemplateDto): void {
    if (!dto.sheets || dto.sheets.length === 0) {
      throw new BadRequestException('O template precisa ter pelo menos 1 aba (sheet).');
    }

    // 1) nomes de sheets únicos
    const sheetNames = new Set<string>();
    for (const s of dto.sheets) {
      const key = s.name.trim().toLowerCase();
      if (sheetNames.has(key)) {
        throw new BadRequestException(`Nome de aba duplicado no template: "${s.name}".`);
      }
      sheetNames.add(key);
    }

    // 2) valida cada sheet
    for (const sheet of dto.sheets) {
      const cells = sheet.cells ?? [];
      const tables = sheet.tables ?? [];

      // 2.1) células únicas por (row,col)
      const cellPos = new Set<string>();
      for (const c of cells) {
        const posKey = `${c.row}:${c.col}`;
        if (cellPos.has(posKey)) {
          throw new BadRequestException(
            `Célula duplicada na aba "${sheet.name}" (row=${c.row}, col=${c.col}).`,
          );
        }
        cellPos.add(posKey);

        // 2.2) valida BIND: fieldKey deve existir no dataset do sheet
        if (c.type === ExcelCellType.BIND) {
          const field = this.excelDatasets.findField(sheet.dataset, c.value);
          if (!field) {
            throw new BadRequestException(
              `FieldKey inválido em célula BIND na aba "${sheet.name}": dataset=${sheet.dataset} key=${c.value}`,
            );
          }
        }
      }

      // 2.3) valida tabelas
      // - Colunas obrigatórias
      // - Colisão básica: evitar célula fixa “em cima” do header/primeira linha da tabela
      // - FieldKey das colunas deve existir no dataset da tabela
      const reserved = new Set<string>(); // posições reservadas pela área inicial de tabelas

      for (const t of tables) {
        if (!t.columns || t.columns.length === 0) {
          throw new BadRequestException(`Tabela sem colunas na aba "${sheet.name}".`);
        }

        // valida fieldKey das colunas
        const orders = new Set<number>();
        for (let i = 0; i < t.columns.length; i++) {
          const col = t.columns[i];
          const ord = col.order ?? i;

          if (orders.has(ord)) {
            throw new BadRequestException(
              `Tabela na aba "${sheet.name}" possui colunas com order duplicado (${ord}).`,
            );
          }
          orders.add(ord);

          const field = this.excelDatasets.findField(t.dataset, col.fieldKey);
          if (!field) {
            throw new BadRequestException(
              `FieldKey inválido em coluna de tabela na aba "${sheet.name}": dataset=${t.dataset} key=${col.fieldKey}`,
            );
          }
        }

        const includeHeader = t.includeHeader ?? true;

        // Reservamos a linha âncora (header OU primeira linha de dados) para evitar colisão com cells fixas.
        // MVP: não tentamos reservar a “altura” total, pois depende do dataset/filters e da quantidade de linhas.
        const reservedRow = t.anchorRow;

        for (let i = 0; i < t.columns.length; i++) {
          const posKey = `${reservedRow}:${t.anchorCol + i}`;

          // colisão entre tabelas (mesma célula inicial)
          if (reserved.has(posKey)) {
            throw new BadRequestException(
              `Colisão entre tabelas na aba "${sheet.name}" na célula (row=${reservedRow}, col=${t.anchorCol + i}).`,
            );
          }
          reserved.add(posKey);

          // colisão com células fixas
          if (cellPos.has(posKey)) {
            const tipo = includeHeader ? 'header' : 'início de dados';
            throw new BadRequestException(
              `Colisão: existe célula fixa na área do ${tipo} da tabela na aba "${sheet.name}" (row=${reservedRow}, col=${t.anchorCol + i}).`,
            );
          }
        }
      }
    }
  }
}
