import { ApiProperty } from '@nestjs/swagger';

/**
 * FairMapAvailableStallFairDto
 *
 * Item de autocomplete para “barracas disponíveis”.
 * Representa StallFair da feira que ainda NÃO está vinculada a nenhum slot no mapa.
 */
export class FairMapAvailableStallFairDto {
  @ApiProperty({ example: 'ckv_stallfair_123' })
  id!: string;

  @ApiProperty({ example: 'Pastel do Zé' })
  stallPdvName!: string;

  @ApiProperty({ example: 'SIZE_3X3' })
  stallSize!: string;

  @ApiProperty({ example: 'João da Silva' })
  ownerName!: string;

  @ApiProperty({ example: '11999999999', nullable: true, required: false })
  ownerPhone?: string | null;
}
