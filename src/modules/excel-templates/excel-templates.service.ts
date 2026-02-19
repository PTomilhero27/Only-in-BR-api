import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExcelCellType,
  ExcelTemplateScope,
  ExcelTemplateStatus,
} from '@prisma/client';

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
 * - Definição de scope do template (para export dinâmico)
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
        scope: true,
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

    return tpl;
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
        scope: (dto.scope as ExcelTemplateScope) ?? ExcelTemplateScope.FAIR,
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

    return created;
  }

  /**
   * Atualiza template.
   *
   * Estratégia MVP:
   * - Atualiza meta (name/status/scope) se vier
   * - Se vier "sheets", faz replace total (delete + nested create)
   */
  async update(
    id: string,
    dto: UpdateExcelTemplateDto,
  ): Promise<ExcelTemplateResponseDto> {
    const existing = await this.prisma.excelTemplate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Template não encontrado.');

    // Se vier estrutura (sheets), validamos como template completo.
    if (dto.sheets) {
      this.validateTemplatePayload({
        name: dto.name ?? 'template',
        status: dto.status,
        scope: (dto.scope as ExcelTemplateScope) ?? ExcelTemplateScope.FAIR,
        sheets: dto.sheets,
      } as CreateExcelTemplateDto);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1) Atualiza meta
      await tx.excelTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.scope !== undefined && {
            scope: dto.scope as ExcelTemplateScope,
          }),
        },
      });

      // 2) Replace estrutural (se aplicável)
      if (dto.sheets) {
        // Apaga sheets (e por cascade apaga cells/tables/columns)
        await tx.excelTemplateSheet.deleteMany({ where: { templateId: id } });

        // Recria sheets com nested create (mais simples e consistente)
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

      // 3) Retorna completo
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
    return updated;
  }

  /**
   * Remove template.
   */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.excelTemplate.findUnique({
      where: { id },
      select: { id: true },
    });

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
      throw new BadRequestException(
        'O template precisa ter pelo menos 1 aba (sheet).',
      );
    }

    // 0) valida scope (MVP: apenas garantir enum + coerência básica)
    // Obs.: validações mais profundas (scope vs datasets) dá pra reforçar depois,
    // mas já deixamos uma base.
    this.validateScopeConsistency(dto);

    // 1) nomes de sheets únicos
    const sheetNames = new Set<string>();
    for (const s of dto.sheets) {
      const key = s.name.trim().toLowerCase();
      if (sheetNames.has(key)) {
        throw new BadRequestException(
          `Nome de aba duplicado no template: "${s.name}".`,
        );
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
          throw new BadRequestException(
            `Tabela sem colunas na aba "${sheet.name}".`,
          );
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

  /**
   * Valida coerência mínima do scope vs conteúdo.
   *
   * MVP (simples):
   * - FAIR/FAIR_OWNER/FAIR_STALL permitem qualquer dataset, mas normalmente fazem sentido com FAIR_*.
   * - OWNER e STALL devem, no mínimo, não depender de "fairId" na prática (isso será reforçado no exports).
   *
   * O objetivo aqui é evitar templates absurdos logo na criação (sem travar evolução).
   */
  private validateScopeConsistency(dto: CreateExcelTemplateDto) {
    const scope: ExcelTemplateScope =
      (dto.scope as ExcelTemplateScope) ?? ExcelTemplateScope.FAIR;

    // regra leve: se scope = OWNER ou STALL, evita datasets explicitamente "por feira" (MVP).
    const allDatasets = (dto.sheets ?? []).map((s) => s.dataset);

    if (scope === ExcelTemplateScope.OWNER) {
      // permitimos FAIR por enquanto, mas avisamos por erro para manter consistência
      if (allDatasets.some((d) => String(d).startsWith('FAIR_'))) {
        throw new BadRequestException(
          `Scope OWNER não deve usar datasets FAIR_* no MVP. Use scope FAIR_OWNER se o contexto for "expositor dentro de uma feira".`,
        );
      }
    }

    if (scope === ExcelTemplateScope.STALL) {
      if (allDatasets.some((d) => String(d).startsWith('FAIR_'))) {
        throw new BadRequestException(
          `Scope STALL não deve usar datasets FAIR_* no MVP. Use scope FAIR_STALL se o contexto for "barraca dentro de uma feira".`,
        );
      }
    }
  }
}
