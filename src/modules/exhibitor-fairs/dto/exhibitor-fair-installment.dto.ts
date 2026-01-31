import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator'

/**
 * DTO de parcela do plano de pagamento do expositor na feira.
 *
 * Responsabilidade:
 * - Fornecer ao front a lista de parcelas com:
 *   - número, vencimento, valor, e status (paga ou não)
 *
 * Decisão:
 * - Datas são expostas como ISO string para padronização entre front/back.
 * - amountCents e paidAmountCents ficam em centavos (evita problemas de float).
 */
export class ExhibitorFairInstallmentDto {
  @ApiProperty({ description: 'Número da parcela (1..N).', example: 1 })
  @IsInt()
  @Min(1)
  number: number

  @ApiProperty({
    description: 'Data de vencimento prevista (ISO).',
    example: '2026-02-10T00:00:00.000Z',
  })
  @IsDateString()
  dueDate: string

  @ApiProperty({ description: 'Valor previsto da parcela (em centavos).', example: 15000 })
  @IsInt()
  @Min(0)
  amountCents: number

  @ApiPropertyOptional({
    description: 'Quando foi pago (ISO). null => não pago.',
    example: '2026-02-10T15:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  paidAt?: string | null

  @ApiPropertyOptional({
    description:
      'Valor efetivamente pago (em centavos). Pode diferir do previsto por desconto/taxa.',
    example: 15000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmountCents?: number | null
}
