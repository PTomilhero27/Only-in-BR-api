// src/modules/interest-fairs/dto/owner-fair-purchase-installment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class OwnerFairPurchaseInstallmentDto {
  /**
   * Número da parcela (1..N).
   */
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  number: number

  /**
   * Data de vencimento (YYYY-MM-DD).
   */
  @ApiProperty({ example: '2026-02-10' })
  @IsString()
  dueDate: string

  /**
   * Valor da parcela (centavos).
   */
  @ApiProperty({ example: 100000 })
  @IsInt()
  @Min(0)
  amountCents: number

  /**
   * Pago em (YYYY-MM-DD) opcional.
   */
  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  paidAt?: string | null

  /**
   * Valor pago real (centavos) opcional.
   */
  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmountCents?: number | null
}
