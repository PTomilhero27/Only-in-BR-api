import { ApiProperty } from '@nestjs/swagger';
import { FairMapStallFairItemDto } from './fair-map-stall-fair-item.dto';

/**
 * FairMapBoothLinkItemDto
 *
 * Um vínculo de slot (clientKey do BOOTH_SLOT) -> StallFair.
 * Retorna detalhes suficientes para o front exibir no modal sem chamadas extras.
 */
export class FairMapBoothLinkItemDto {
  @ApiProperty({ example: 'booth_abcd123' })
  slotClientKey!: string;

  @ApiProperty({ example: 'ckv_stallfair_123' })
  stallFairId!: string;

  @ApiProperty({ type: FairMapStallFairItemDto })
  stallFair!: FairMapStallFairItemDto;
}
