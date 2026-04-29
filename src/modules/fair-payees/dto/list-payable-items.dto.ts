import { ApiPropertyOptional } from '@nestjs/swagger';
import { PixRemittancePayeeType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Filtros para consultar favorecidos que podem entrar em remessa PIX.
 * Une parcelas de fornecedores e repasses de expositores sem duplicar cadastro.
 */
export class ListPayableItemsDto {
  @ApiPropertyOptional({ enum: PixRemittancePayeeType })
  @IsOptional()
  @IsEnum(PixRemittancePayeeType)
  payeeType?: PixRemittancePayeeType;

  @ApiPropertyOptional({
    description: 'Busca por nome, documento ou descricao.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
