

/**
 * ✅ Tipos Runtime do Template
 *
 * Estes tipos representam o "shape" do template já carregado do banco,
 * com sheets/cells/tables/columns.
 *
 * Por que não usar diretamente os tipos Prisma?
 * - Mantemos o core mais independente e testável
 * - Permite mapear/transformar caso o schema evolua
 */

import { ExcelCellType, ExcelDataset, ExcelValueFormat } from "@prisma/client";

export type ExcelTemplateRuntime = {
  id: string;
  name: string;

  /**
   * Sheets já devem vir ordenadas por `order` no carregamento do service.
   */
  sheets: ExcelTemplateSheetRuntime[];
};

export type ExcelTemplateSheetRuntime = {
  id: string;
  name: string;
  order: number;

  /**
   * Dataset "base" do sheet (contexto padrão para validação/UI).
   * Obs.: a tabela pode ter dataset diferente do sheet.
   */
  dataset: ExcelDataset;

  cells: ExcelTemplateCellRuntime[];
  tables: ExcelTemplateTableRuntime[];
};

export type ExcelTemplateCellRuntime = {
  id: string;
  row: number; // 1-based
  col: number; // 1-based
  type: ExcelCellType;

  /**
   * TEXT: texto literal
   * BIND: fieldKey (ex.: "fair.name")
   */
  value: string;

  /**
   * Formatação opcional (ex.: MONEY_CENTS).
   */
  format?: ExcelValueFormat | null;

  /**
   * Estilo mínimo do MVP.
   */
  bold: boolean;
};

export type ExcelTemplateTableRuntime = {
  id: string;

  anchorRow: number; // 1-based
  anchorCol: number; // 1-based

  dataset: ExcelDataset;

  includeHeader: boolean;

  columns: ExcelTemplateTableColumnRuntime[];
};

export type ExcelTemplateTableColumnRuntime = {
  id: string;
  order: number;

  header: string;
  fieldKey: string;

  format?: ExcelValueFormat | null;
  width?: number | null;
};
