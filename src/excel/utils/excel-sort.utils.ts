/**
 * ✅ Helpers de ordenação
 *
 * Mantemos em util para padronizar como ordenamos sheets, cells e columns.
 */
export function sortByNumber<T>(arr: T[], pick: (i: T) => number): T[] {
  return [...arr].sort((a, b) => pick(a) - pick(b));
}
