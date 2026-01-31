import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { OwnerFairStallSlotDto } from './owner-fair-stall-slot.dto';
import { OwnerFairPaymentPlanDto } from './owner-fair-payment-plan.dto';

/**
 * DTO para criar o vínculo Owner ↔ Fair.
 *
 * Regra do projeto:
 * - stallsQty NÃO é enviado: é derivado da soma dos slots.
 * - No create, SEMPRE enviar stallSlots + paymentPlan.
 */
export class LinkInterestToFairDto {
  @ApiProperty({
    description: 'ID da feira a ser vinculada.',
    example: 'e2afa654-2b99-4364-92e6-cce6643cc067',
  })
  @IsString()
  @IsNotEmpty()
  fairId!: string;

  @ApiProperty({
    description:
      'Compra de barracas por tamanho. Não repetir stallSize. qty >= 1. unitPriceCents >= 0.',
    type: () => [OwnerFairStallSlotDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OwnerFairStallSlotDto)
  stallSlots!: OwnerFairStallSlotDto[];

  @ApiProperty({
    description:
      'Plano de pagamento (parcelas, datas, marcação de pago).',
    type: () => OwnerFairPaymentPlanDto,
  })
  @ValidateNested()
  @Type(() => OwnerFairPaymentPlanDto)
  paymentPlan!: OwnerFairPaymentPlanDto;
}
