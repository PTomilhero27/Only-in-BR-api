import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator'

/**
 * DTO para reprogramar vencimento de uma parcela (acordo/negociação).
 * Responsabilidade:
 * - Permitir mudar dueDate (date-only) sem alterar pagamentos já registrados.
 */
export class RescheduleInstallmentDto {
  @ApiProperty({
    description: 'Nova data de vencimento (YYYY-MM-DD).',
    example: '2026-02-10',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dueDate deve estar no formato YYYY-MM-DD.' })
  dueDate!: string

  @ApiPropertyOptional({
    description: 'Motivo/observação da reprogramação (para auditoria).',
    example: 'Cliente negociou prorrogação por dificuldades no caixa.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}
