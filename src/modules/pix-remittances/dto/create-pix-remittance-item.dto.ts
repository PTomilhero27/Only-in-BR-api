import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PixRemittancePayeeType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

/**
 * DTO para item solicitado para geracao de remessa.
 * Define o valor exato, o grupo (em caso de divisao) e o vinculo com a parcela.
 */
export class CreatePixRemittanceItemDto {
  @ApiProperty({ enum: PixRemittancePayeeType, description: 'Tipo do favorecido (Fornecedor ou Expositor)' })
  @IsEnum(PixRemittancePayeeType)
  payeeType!: PixRemittancePayeeType;

  @ApiPropertyOptional({
    description: 'Parcela de fornecedor quando payeeType=SUPPLIER.',
  })
  @IsOptional()
  @IsString()
  supplierInstallmentId?: string;

  @ApiPropertyOptional({
    description: 'Repasse de expositor quando payeeType=EXHIBITOR.',
  })
  @IsOptional()
  @IsString()
  exhibitorPayoutId?: string;

  @ApiProperty({ description: 'Valor a ser pago na remessa (em centavos)', example: 60000 })
  @IsInt()
  @IsPositive()
  amountCents!: number;

  @ApiPropertyOptional({ description: 'Grupo em caso de divisao (1 ou 2)', example: 1 })
  @IsOptional()
  @IsInt()
  group?: number;
}
