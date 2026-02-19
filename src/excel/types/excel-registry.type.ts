import { ExcelDataset, ExcelValueFormat } from '@prisma/client';
import { ExcelContext } from './excel-context.type';

/**
 * Parâmetros de escopo para montar o contexto de export:
 * - UUID: Fair.id (uuid)
 * - CUID: Owner/Stall/etc (cuid)
 */
export type ExcelScopeParamType = 'UUID' | 'CUID';

/**
 * Chaves aceitas hoje no seu export.
 * (Se amanhã você adicionar purchaseId, é só colocar aqui.)
 */
export type ExcelScopeParamKey = 'fairId' | 'ownerId' | 'stallId';

export type ExcelDatasetScopeParam = {
  key: ExcelScopeParamKey;
  label: string;
  type: ExcelScopeParamType;
  required: boolean;
  hint?: string;
};

/**
 * ✅ Campo disponível no catálogo (dataset -> fields)
 */
export type ExcelDatasetFieldDefinition = {
  fieldKey: string;
  label: string;

  /**
   * ✅ obrigatório no catálogo (evita “format?: …” quebrar tipagem)
   */
  format: ExcelValueFormat;

  group?: string;
  hint?: string;

  resolve: (ctx: ExcelContext, row?: Record<string, unknown>) => unknown;
};

/**
 * ✅ Dataset (catálogo)
 * Agora inclui scope (porque você precisa disso pro requirements/export dialog).
 */
export type ExcelDatasetDefinition = {
  dataset: ExcelDataset;
  label: string;
  scope: ExcelDatasetScopeParam[];
  fields: ExcelDatasetFieldDefinition[];
};

/**
 * ✅ Interface consumida pelo gerador/validadores
 */
export interface ExcelRegistry {
  getDatasetDefinition(dataset: ExcelDataset): ExcelDatasetDefinition;

  findField(
    dataset: ExcelDataset,
    fieldKey: string,
  ): ExcelDatasetFieldDefinition | null;
}
