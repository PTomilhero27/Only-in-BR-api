import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { OwnerFairPaymentStatus } from '@prisma/client';
import { OwnerFairInstallmentDto } from './owner-fair-installment.dto';

/**
 * DTO do plano de pagamento do vínculo Owner ↔ Fair.
 *
 * Regras esperadas (validadas no service também):
 * - installmentsCount: 1..12
 * - installments.length == installmentsCount
 * - soma amountCents == totalCents
 * - números das parcelas 1..N sem repetir
 * - dueDate obrigatório em todas
 */
export class OwnerFairPaymentPlanDto {
  @ApiProperty({
    description: 'Quantidade de parcelas (1 = à vista).',
    example: 2,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  installmentsCount!: number;

  @ApiProperty({
    description: 'Valor total acordado (em centavos).',
    example: 800000,
  })
  @IsInt()
  @Min(0)
  totalCents!: number;

  @ApiPropertyOptional({
    description:
      'Status agregado do plano. Normalmente calculado no backend a partir das parcelas.',
    enum: OwnerFairPaymentStatus,
    example: OwnerFairPaymentStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(OwnerFairPaymentStatus)
  status?: OwnerFairPaymentStatus;

  @ApiProperty({
    description: 'Lista de parcelas com vencimento/valor e marcação de pago.',
    type: () => [OwnerFairInstallmentDto],
    example: [
      {
        number: 1,
        dueDate: '2026-01-30',
        amountCents: 400000,
        paidAt: '2026-01-30',
        paidAmountCents: 400000,
      },
      {
        number: 2,
        dueDate: '2026-01-31',
        amountCents: 400000,
        paidAt: null,
        paidAmountCents: null,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OwnerFairInstallmentDto)
  installments!: OwnerFairInstallmentDto[];
}
