import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO para vincular/desvincular um slot de barraca (BOOTH_SLOT) a uma StallFair.
 * - stallFairId informado => cria/atualiza vínculo
 * - stallFairId null/omitido => remove vínculo
 */
export class LinkBoothSlotDto {
  @ApiPropertyOptional({
    example: 'ckv_stallfair_123',
    nullable: true,
    description:
      'ID da StallFair para vincular ao slot. Envie null para desvincular.',
  })
  @IsOptional()
  @IsString()
  stallFairId?: string | null;
}
