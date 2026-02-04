import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'

/**
 * DTO de parcela de uma compra (OwnerFairPurchaseInstallment).
 *
 * Observação:
 * - dueDate é "date-only" (YYYY-MM-DD) para simplificar entrada no Admin.
 * - paidAt também é "date-only" opcional (caso o admin marque como pago futuramente).
 */
export class OwnerFairInstallmentDto {
  @ApiProperty({
    example: 1,
    description: 'Número sequencial da parcela (1..N).',
  })
  @IsInt()
  @Min(1)
  number: number

  @ApiProperty({
    example: '2026-02-03',
    description: 'Data de vencimento (YYYY-MM-DD).',
  })
  @IsString()
  dueDate: string

  @ApiProperty({
    example: 100000,
    description: 'Valor da parcela em centavos.',
  })
  @IsInt()
  @Min(0)
  amountCents: number

  @ApiPropertyOptional({
    example: '2026-02-03',
    description: 'Data em que foi paga (YYYY-MM-DD). Opcional.',
  })
  @IsOptional()
  @IsString()
  paidAt?: string | null

  @ApiPropertyOptional({
    example: 100000,
    description:
      'Valor efetivamente pago em centavos (caso diferente do valor previsto). Opcional.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmountCents?: number | null
}
