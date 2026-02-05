import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO para atualizar observações internas do admin no vínculo Owner ↔ Fair (OwnerFair).
 * Esse campo é livre e serve para anotações operacionais.
 */
export class UpdateOwnerFairObservationsDto {
  @ApiPropertyOptional({
    example: 'Expositor pediu para ficar próximo ao palco. Chegar 12h.',
    description: 'Observações internas do admin para este expositor nesta feira.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  observations?: string;
}
