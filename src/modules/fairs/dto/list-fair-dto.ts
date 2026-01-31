import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FairStatus } from '@prisma/client';

/**
 * DTO de filtros para listagem de feiras.
 * Mantido como DTO para documentar claramente o contrato HTTP.
 */
export class ListFairsDto {
  @ApiPropertyOptional({
    enum: FairStatus,
    example: FairStatus.ATIVA,
    description: 'Filtrar feiras por status.',
  })
  @IsEnum(FairStatus)
  @IsOptional()
  status?: FairStatus;
}
