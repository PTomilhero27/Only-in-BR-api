import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'

/**
 * Parcela de uma compra (OwnerFairPurchaseInstallment) para exibição no portal.
 */
export class ExhibitorFairPurchaseInstallmentDto {
  @ApiProperty({ example: 1, description: 'Número sequencial da parcela (1..N).' })
  @IsInt()
  @Min(1)
  number!: number

  @ApiProperty({ example: '2026-03-10T00:00:00.000Z', description: 'Vencimento (ISO).' })
  @IsString()
  dueDate!: string

  @ApiProperty({ example: 50000, description: 'Valor da parcela (centavos).' })
  @IsInt()
  @Min(0)
  amountCents!: number

  @ApiPropertyOptional({
    example: '2026-03-05T12:00:00.000Z',
    description: 'Data em que a parcela foi marcada como paga (ISO).',
  })
  @IsOptional()
  @IsString()
  paidAt!: string | null

  @ApiPropertyOptional({
    example: 50000,
    description: 'Valor efetivamente pago (centavos), se diferente do previsto.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmountCents!: number | null
}
