import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { OwnerFairPaymentStatus } from '@prisma/client';
import { ExhibitorFairInstallmentDto } from './exhibitor-fair-installment.dto';

/**
 * Resumo do pagamento do expositor em uma feira.
 *
 * Responsabilidade:
 * - Expor para o portal dados claros e prontos para UI:
 *   - status agregado (PENDING/PARTIALLY_PAID/PAID/OVERDUE/CANCELLED)
 *   - total, número de parcelas, quantas pagas
 *   - próxima data de vencimento (se existir)
 *   - lista de parcelas (para detalhar no dialog/accordion)
 *
 * Decisão:
 * - nextDueDate é calculado no backend para evitar "contratos implícitos" no front.
 */
export class ExhibitorFairPaymentSummaryDto {
  @ApiProperty({
    enum: OwnerFairPaymentStatus,
    description: 'Status agregado do plano de pagamento.',
    example: 'PARTIALLY_PAID',
  })
  @IsEnum(OwnerFairPaymentStatus)
  status: OwnerFairPaymentStatus;

  @ApiProperty({
    description: 'Valor total acordado (em centavos).',
    example: 45000,
  })
  @IsInt()
  @Min(0)
  totalCents: number;

  @ApiProperty({
    description: 'Quantidade de parcelas (1 = à vista).',
    example: 3,
  })
  @IsInt()
  @Min(1)
  installmentsCount: number;

  @ApiProperty({ description: 'Quantidade de parcelas já pagas.', example: 1 })
  @IsInt()
  @Min(0)
  paidCount: number;

  @ApiPropertyOptional({
    description:
      'Próximo vencimento em aberto (ISO). null => tudo pago ou sem parcelas.',
    example: '2026-03-10T00:00:00.000Z',
  })
  @IsOptional()
  nextDueDate?: string | null;

  @ApiProperty({
    type: [ExhibitorFairInstallmentDto],
    description: 'Lista de parcelas (ordenadas).',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExhibitorFairInstallmentDto)
  installments: ExhibitorFairInstallmentDto[];
}
