/**
 * ✅ Normaliza o nome da aba para evitar erros do Excel
 *
 * Regras práticas:
 * - Limite de 31 caracteres
 * - Não permitir caracteres inválidos: : \ / ? * [ ]
 * - Evitar nome vazio
 */
export function sanitizeWorksheetName(name: string): string {
  const cleaned = (name ?? '')
    .trim()
    .replace(/[:\\\/\?\*\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const safe = cleaned.length > 0 ? cleaned : 'Planilha';
  return safe.slice(0, 31);
}
