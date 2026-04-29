import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExhibitorPayoutStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Filtros da listagem de repasses.
 * Permite ao financeiro localizar expositores por texto e por status do repasse.
 */
export class ListExhibitorPayoutsDto {
  @ApiPropertyOptional({ enum: ExhibitorPayoutStatus })
  @IsOptional()
  @IsEnum(ExhibitorPayoutStatus)
  status?: ExhibitorPayoutStatus;

  @ApiPropertyOptional({
    description: 'Busca por nome, documento, email ou telefone do expositor.',
    example: 'Pastel',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
