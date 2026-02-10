import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';

import { ExcelTemplateRuntime } from './types/excel-template-runtime.type';
import { ExcelContext } from './types/excel-context.type';
import { ExcelRegistry } from './types/excel-registry.type';

import { sanitizeWorksheetName } from './utils/excel-sheet.utils';
import { sortByNumber } from './utils/excel-sort.utils';
import { getExcelNumFmt, moneyCentsToReais, toDate } from './utils/excel-format.utils';
import { ExcelCellType, ExcelValueFormat } from '@prisma/client';

/**
 * ✅ ExcelGeneratorService
 *
 * Responsável por transformar um template (células fixas + tabelas dinâmicas)
 * em um arquivo .xlsx real usando ExcelJS.
 *
 * Importante:
 * - Este service NÃO busca dados no banco.
 * - Ele consome:
 *   1) template já carregado (runtime)
 *   2) ctx com dados (root + lists)
 *   3) registry para resolver fieldKeys (catálogo oficial)
 *
 * Assim mantemos:
 * - Excel core desacoplado de Prisma/Services de negócio
 * - Fácil de testar (inputs -> output)
 */
@Injectable()
export class ExcelGeneratorService {
  /**
   * Gera um arquivo .xlsx (buffer) a partir do template.
   *
   * @param template Template carregado do banco (com sheets/cells/tables)
   * @param ctx Contexto de dados (root + lists por dataset)
   * @param registry Registry/catálogo para resolver fieldKeys
   */
  async generateXlsxBuffer(params: {
    template: ExcelTemplateRuntime;
    ctx: ExcelContext;
    registry: ExcelRegistry;
  }): Promise<Buffer> {
    const { template, ctx, registry } = params;

    const workbook = new Workbook();

    // ✅ Metadados úteis (opcional)
    workbook.creator = 'Only in BR';
    workbook.created = new Date();

    const sheetsSorted = sortByNumber(template.sheets, (s) => s.order);

    for (const sheet of sheetsSorted) {
      const ws = workbook.addWorksheet(sanitizeWorksheetName(sheet.name));

      // 1) CÉLULAS FIXAS
      const cellsSorted = sortByNumber(sheet.cells, (c) => c.row * 10_000 + c.col);

      for (const cell of cellsSorted) {
        const excelCell = ws.getCell(cell.row, cell.col);

        if (cell.type === ExcelCellType.TEXT) {
          excelCell.value = cell.value ?? '';
        }

        if (cell.type === ExcelCellType.BIND) {
          // Em célula fixa, tentamos resolver pelo dataset do sheet por padrão.
          // Se o field não existir no dataset do sheet, lançamos erro (melhor do que gerar vazio silencioso).
          const def = registry.findField(sheet.dataset, cell.value);
          if (!def) {
            throw new Error(
              `FieldKey inválido no template (cell bind): dataset=${sheet.dataset} key=${cell.value}`,
            );
          }

          const rawValue = def.resolve(ctx);
          const finalFormat = cell.format ?? def.format;

          this.applyValueAndFormat({
            excelCell,
            value: rawValue,
            format: finalFormat,
          });
        }

        // ✅ Estilo mínimo MVP
        if (cell.bold) {
          excelCell.font = { ...(excelCell.font ?? {}), bold: true };
        }
      }

      // 2) TABELAS DINÂMICAS
      const tablesSorted = sortByNumber(sheet.tables, (t) => t.anchorRow * 10_000 + t.anchorCol);

      for (const table of tablesSorted) {
        const colsSorted = sortByNumber(table.columns, (c) => c.order);

        // Ajusta widths (se informado)
        for (let i = 0; i < colsSorted.length; i++) {
          const width = colsSorted[i].width ?? undefined;
          if (width && width > 0) {
            ws.getColumn(table.anchorCol + i).width = width;
          }
        }

        const startRow = table.anchorRow;
        const startCol = table.anchorCol;

        const headerRowOffset = table.includeHeader ? 0 : -1;
        const firstDataRow = startRow + (table.includeHeader ? 1 : 0);

        // 2.1) Header
        if (table.includeHeader) {
          for (let i = 0; i < colsSorted.length; i++) {
            const colDef = colsSorted[i];
            const headerCell = ws.getCell(startRow, startCol + i);

            headerCell.value = colDef.header ?? '';
            headerCell.font = { ...(headerCell.font ?? {}), bold: true };
          }
        }

        // 2.2) Rows
        const listKey = String(table.dataset);
        const rows = ctx.lists?.[listKey] ?? [];

        for (let r = 0; r < rows.length; r++) {
          const rowObj = rows[r];
          const rowIndex = firstDataRow + r;

          for (let c = 0; c < colsSorted.length; c++) {
            const colDef = colsSorted[c];

            const field = registry.findField(table.dataset, colDef.fieldKey);
            if (!field) {
              throw new Error(
                `FieldKey inválido no template (table column): dataset=${table.dataset} key=${colDef.fieldKey}`,
              );
            }

            const rawValue = field.resolve(ctx, rowObj);
            const finalFormat = colDef.format ?? field.format;

            const cell = ws.getCell(rowIndex, startCol + c);

            this.applyValueAndFormat({
              excelCell: cell,
              value: rawValue,
              format: finalFormat,
            });
          }
        }

        // ✅ Se não tiver linhas, não quebramos o Excel.
        // (No futuro podemos opcionalmente escrever "Sem dados" abaixo do header)
        void headerRowOffset;
      }

      // ✅ Congelamento opcional:
      // ws.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    return Buffer.from(buffer);
  }

  /**
   * Aplica value + format no ExcelJS Cell.
   *
   * Por que existe:
   * - Centraliza conversões (centavos -> reais, datas -> Date)
   * - Aplica numFmt de forma consistente
   */
  private applyValueAndFormat(params: {
    excelCell: any; // ExcelJS Cell
    value: unknown;
    format: ExcelValueFormat;
  }): void {
    const { excelCell, value, format } = params;

    // Define numFmt quando aplicável
    const numFmt = getExcelNumFmt(format);
    if (numFmt) {
      excelCell.numFmt = numFmt;
    }

    switch (format) {
      case ExcelValueFormat.MONEY_CENTS: {
        // Em MONEY_CENTS esperamos centavos e convertemos para reais (number).
        excelCell.value = moneyCentsToReais(value);
        return;
      }

      case ExcelValueFormat.INT: {
        const n = typeof value === 'number' ? value : Number(value ?? 0);
        excelCell.value = Number.isFinite(n) ? n : 0;
        return;
      }

      case ExcelValueFormat.DATE:
      case ExcelValueFormat.DATETIME: {
        const d = toDate(value);
        // Excel lida melhor quando value é Date
        excelCell.value = d ?? '';
        return;
      }

      case ExcelValueFormat.BOOL: {
        // No MVP podemos manter boolean ou converter para "SIM/NÃO".
        // Aqui optamos por boolean real (Excel trata como TRUE/FALSE).
        if (typeof value === 'boolean') {
          excelCell.value = value;
        } else {
          const v = String(value ?? '').toLowerCase();
          excelCell.value = ['true', '1', 'sim', 'yes'].includes(v);
        }
        return;
      }

      case ExcelValueFormat.TEXT:
      default: {
        // ExcelJS aceita string/number/date/boolean.
        // Para TEXT garantimos string.
        excelCell.value = value == null ? '' : String(value);
        return;
      }
    }
  }
}
