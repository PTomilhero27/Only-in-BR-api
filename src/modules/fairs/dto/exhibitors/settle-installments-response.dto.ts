import { ApiProperty } from '@nestjs/swagger'
import { OwnerFairPaymentStatus } from '@prisma/client'

/**
 * DTO de resposta para a operação de pagamento/desfazer pagamento
 * de parcelas do expositor em uma feira.
 *
 * Responsabilidade:
 * - Confirmar sucesso da operação
 * - Retornar status agregado do plano após a ação
 * - Expor métricas suficientes para o front atualizar a UI
 *   sem precisar inferir estado
 *
 * Observação:
 * - A listagem completa das parcelas continua vindo
 *   do GET /fairs/:id/exhibitors (fonte de verdade da tabela).
 */
export class SettleInstallmentsResponseDto {
  @ApiProperty({
    description: 'Indica se a operação foi executada com sucesso.',
    example: true,
  })
  ok!: boolean

  @ApiProperty({
    description: 'ID do plano de pagamento do expositor nesta feira.',
    example: 'cku3l2q9s0001k2x9abcd1234',
  })
  planId!: string

  @ApiProperty({
    enum: OwnerFairPaymentStatus,
    description:
      'Status agregado do plano de pagamento após a operação.',
    example: OwnerFairPaymentStatus.PARTIALLY_PAID,
  })
  status!: OwnerFairPaymentStatus

  @ApiProperty({
    description:
      'Quantidade total de parcelas previstas no plano.',
    example: 3,
  })
  installmentsCount!: number

  @ApiProperty({
    description:
      'Quantidade de parcelas pagas após a operação.',
    example: 1,
  })
  paidCount!: number
}
