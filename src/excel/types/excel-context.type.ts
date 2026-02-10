/**
 * ✅ ExcelContext
 *
 * Contexto de dados carregado pelo módulo de exportação (excel-exports)
 * e usado pelo gerador para resolver BINDs (células e colunas de tabelas).
 *
 * Observação:
 * - O core não decide como buscar dados no banco.
 * - Ele apenas consome esse contexto + um "resolver" (registry).
 */
export type ExcelContext = {
  /**
   * Contexto global/raiz da exportação.
   * Ex.: dados da feira, período, capacidade, etc.
   */
  root: Record<string, unknown>;

  /**
   * Listas por dataset para alimentar tabelas dinâmicas.
   * Ex.: FAIR_EXHIBITORS -> array de rows (cada row é o “registro” da linha)
   */
  lists: Partial<Record<string, Array<Record<string, unknown>>>>;
};
