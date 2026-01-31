/**
 * Normaliza o nome interno (PDV) para evitar duplicidade lógica.
 * Responsabilidade:
 * - Transformar entradas como " Pastel  do Zé " em "pastel do zé"
 *
 * Observação:
 * - O Prisma já garante unicidade por @@unique([ownerId, pdvNameNormalized]),
 *   mas normalizar aqui melhora previsibilidade e mensagens de erro.
 */
export function normalizePdvName(value: string) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
