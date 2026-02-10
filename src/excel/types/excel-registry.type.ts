import { ExcelDataset, ExcelValueFormat } from '@prisma/client';
import { ExcelContext } from './excel-context.type';

/**
 * ✅ ExcelDatasetFieldDefinition
 *
 * Define um campo disponível no catálogo (dataset -> fields),
 * com label/format e o resolver que entrega o valor.
 */
export type ExcelDatasetFieldDefinition = {
  key: string;
  label: string;
  format: ExcelValueFormat;

  /**
   * Resolve o valor do campo.
   *
   * - ctx.root: contexto global (ex.: fair)
   * - row: registro atual (em tabelas dinâmicas)
   */
  resolve: (ctx: ExcelContext, row?: Record<string, unknown>) => unknown;
};

/**
 * ✅ ExcelDatasetDefinition
 *
 * Define um dataset (ex.: FAIR_EXHIBITORS) com seus fields permitidos.
 */
export type ExcelDatasetDefinition = {
  dataset: ExcelDataset;
  label: string;
  fields: ExcelDatasetFieldDefinition[];
};

/**
 * ✅ ExcelRegistry
 *
 * Interface consumida pelo gerador para:
 * - validar/resolver fieldKey
 * - obter formato default do campo (se template não informar)
 *
 * Implementação:
 * - Deve ficar no módulo excel-datasets (ExcelDatasetsService)
 * - O core só depende desta interface
 */
export interface ExcelRegistry {
  getDatasetDefinition(dataset: ExcelDataset): ExcelDatasetDefinition;

  /**
   * Retorna um field por dataset + key, ou null se não existir.
   */
  findField(dataset: ExcelDataset, key: string): ExcelDatasetFieldDefinition | null;
}
