import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator'

/**
 * DTO para registrar um pagamento (histórico) em uma parcela.
 * Suporta pagamento parcial: múltiplos pagamentos por parcela.
 */
export class CreateInstallmentPaymentDto {
  @ApiProperty({
    description: 'Data do pagamento (YYYY-MM-DD).',
    example: '2026-02-04',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'paidAt deve estar no formato YYYY-MM-DD.' })
  paidAt!: string

  @ApiProperty({
    description: 'Valor pago em centavos (>= 1).',
    example: 1000,
  })
  @IsInt()
  @Min(1)
  amountCents!: number

  @ApiPropertyOptional({
    description: 'Observação opcional do pagamento/acordo.',
    example: 'Pagamento parcial via PIX; combinado quitar o restante semana que vem.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}
