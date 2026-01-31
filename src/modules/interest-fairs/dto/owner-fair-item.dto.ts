import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { OwnerFairStallSlotDto } from './owner-fair-stall-slot.dto';
import { OwnerFairPaymentPlanDto } from './owner-fair-payment-plan.dto';

/**
 * Item retornado na listagem de feiras vinculadas a um interessado.
 * Inclui compra por tamanho (stallSlots) e plano de pagamento (paymentPlan).
 */
export class OwnerFairItemDto {
  @ApiProperty({ description: 'ID da feira.', example: 'e2afa654-2b99-4364-92e6-cce6643cc067' })
  @IsString()
  @IsNotEmpty()
  fairId!: string;

  @ApiProperty({ description: 'Nome da feira.', example: 'Feira Gastronômica Centro' })
  @IsString()
  @IsNotEmpty()
  fairName!: string;

  @ApiProperty({
    description: 'Quantidade total de barracas compradas (derivada da soma dos slots).',
    example: 2,
  })
  @IsInt()
  stallsQty!: number;

  @ApiProperty({
    description: 'Compra por tamanho (slots).',
    type: () => [OwnerFairStallSlotDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerFairStallSlotDto)
  stallSlots!: OwnerFairStallSlotDto[];

  @ApiProperty({
    description: 'Plano de pagamento do vínculo.',
    type: () => OwnerFairPaymentPlanDto,
  })
  @ValidateNested()
  @Type(() => OwnerFairPaymentPlanDto)
  paymentPlan!: OwnerFairPaymentPlanDto;

  @ApiProperty({
    description: 'Data de criação (ISO string).',
    example: '2026-01-30T00:00:00.000Z',
  })
  @IsString()
  createdAt!: string;

  @ApiProperty({
    description: 'Data da última atualização (ISO string).',
    example: '2026-01-30T00:00:00.000Z',
  })
  @IsString()
  updatedAt!: string;
}
