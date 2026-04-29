import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PixRemittancePayeeType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * Item solicitado para geracao de remessa.
 * SUPPLIER exige supplierInstallmentId; EXHIBITOR exige exhibitorPayoutId.
 */
export class CreatePixRemittanceItemDto {
  @ApiProperty({ enum: PixRemittancePayeeType })
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
}

/**
 * DTO para criar remessa PIX da feira.
 * A lista de itens pode misturar fornecedores/prestadores e expositores.
 */
export class CreatePixRemittanceDto {
  @ApiProperty({
    description: 'Data de pagamento informada no arquivo.',
    example: '2026-05-20T00:00:00.000Z',
  })
  @IsString()
  paymentDate!: string;

  @ApiPropertyOptional({
    description: 'Descricao administrativa da remessa.',
    example: 'Pagamento pos-evento de expositores e fornecedores',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CreatePixRemittanceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePixRemittanceItemDto)
  items!: CreatePixRemittanceItemDto[];
}
