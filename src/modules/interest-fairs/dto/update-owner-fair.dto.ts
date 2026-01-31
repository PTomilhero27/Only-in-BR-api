import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { OwnerFairStallSlotDto } from './owner-fair-stall-slot.dto';
import { OwnerFairPaymentPlanDto } from './owner-fair-payment-plan.dto';

/**
 * DTO para atualizar o vínculo Owner ↔ Fair.
 *
 * Regra definida:
 * - Para editar o vínculo, SEMPRE enviar stallSlots + paymentPlan.
 * Motivo:
 * - O backend recalcula stallsQty e recalcula status de pagamento.
 * - Evita payloads parciais que podem deixar estado inconsistente.
 */
export class UpdateOwnerFairDto {
  @ApiProperty({
    description:
      'Compra de barracas por tamanho. Substitui o conjunto inteiro. stallsQty será recalculado.',
    type: () => [OwnerFairStallSlotDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OwnerFairStallSlotDto)
  stallSlots!: OwnerFairStallSlotDto[];

  @ApiProperty({
    description: 'Plano de pagamento. Substitui plano/parcelas.',
    type: () => OwnerFairPaymentPlanDto,
  })
  @ValidateNested()
  @Type(() => OwnerFairPaymentPlanDto)
  paymentPlan!: OwnerFairPaymentPlanDto;
}
