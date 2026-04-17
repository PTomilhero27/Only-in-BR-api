import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OwnerFairPurchaseInstallmentDto } from 'src/modules/interest-fairs/dto/owner-fair-purchase-installment.dto';

export class ConfirmReservationDto {
  @ApiPropertyOptional({
    description:
      'Barraca a ser vinculada no momento da confirmação. Se omitido, usa a barraca da própria reserva.',
    example: 'ckv_stall_123',
  })
  @IsOptional()
  @IsString()
  stallId?: string;

  @ApiPropertyOptional({
    description:
      'Valor final da barraca em centavos. Se omitido, usa o preço capturado na reserva.',
    example: 150000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  unitPriceCents?: number;

  @ApiPropertyOptional({
    description: 'Valor pago no ato em centavos.',
    example: 50000,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paidCents?: number;

  @ApiPropertyOptional({
    description:
      'Quantidade de parcelas do restante. Segue as mesmas regras do módulo interest-fairs.',
    example: 2,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsCount?: number;

  @ApiPropertyOptional({
    type: [OwnerFairPurchaseInstallmentDto],
    description:
      'Parcelas do restante. Obrigatório quando houver valor pendente.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => OwnerFairPurchaseInstallmentDto)
  installments?: OwnerFairPurchaseInstallmentDto[];
}
