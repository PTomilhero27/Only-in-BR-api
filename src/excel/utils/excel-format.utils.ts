import { ExcelValueFormat } from '@prisma/client';

/**
 * ✅ Regras de formatação do Excel (numFmt)
 *
 * Mantemos como util para padronizar o "visual" de valores no Excel
 * e evitar replicar strings de formato em vários lugares.
 *
 * Observação:
 * - ExcelJS usa padrões de numFmt do Excel.
 * - Para MONEY, o valor recomendado é number (em reais) com numFmt de moeda.
 */
export function getExcelNumFmt(format: ExcelValueFormat | null | undefined): string | undefined {
  if (!format) return undefined;

  switch (format) {
    case ExcelValueFormat.MONEY_CENTS:
      // Formato de moeda (R$). Em muitos Excel instala pt-BR funciona bem.
      return '"R$" #,##0.00';
    case ExcelValueFormat.DATE:
      return 'dd/mm/yyyy';
    case ExcelValueFormat.DATETIME:
      return 'dd/mm/yyyy hh:mm';
    case ExcelValueFormat.INT:
      return '0';
    case ExcelValueFormat.BOOL:
    case ExcelValueFormat.TEXT:
    default:
      return undefined;
  }
}

/**
 * ✅ Converte centavos -> reais (number)
 *
 * Ex.: 12345 -> 123.45
 */
export function moneyCentsToReais(value: unknown): number {
  const cents = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(cents)) return 0;
  return cents / 100;
}

/**
 * ✅ Tenta normalizar valores de data/hora em Date
 *
 * Aceita:
 * - Date
 * - ISO string
 * - timestamp number
 */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d;
}
