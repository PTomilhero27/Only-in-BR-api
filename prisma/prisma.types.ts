import { PrismaClient } from "@prisma/client/extension";

/**
 * PrismaTransaction
 *
 * Responsabilidade:
 * - Tipar corretamente o `tx` recebido dentro do prisma.$transaction(...)
 *
 * Observação:
 * - O tx é um PrismaClient "sem" métodos de conexão e outros que não fazem sentido dentro da transação.
 */
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>
