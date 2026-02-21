import { ApiProperty } from '@nestjs/swagger';

/**
 * FairMapStallFairItemDto
 *
 * Representa uma opção de StallFair “linkável” no mapa:
 * - É a unidade operacional/financeira da barraca na feira
 * - É o que o admin vincula a um slot (BOOTH_SLOT)
 */
export class FairMapStallFairItemDto {
  @ApiProperty({ example: 'ckv_stallfair_123' })
  id!: string;

  @ApiProperty({ example: 'ckv_fair_123' })
  fairId!: string;

  @ApiProperty({ example: 'ckv_ownerfair_123' })
  ownerFairId!: string;

  @ApiProperty({ example: 'ckv_stall_123' })
  stallId!: string;

  @ApiProperty({ example: 'Pastel do Zé' })
  stallPdvName!: string;

  @ApiProperty({ example: 'SIZE_3X3' })
  stallSize!: string;

  @ApiProperty({ example: 'João da Silva' })
  ownerName!: string;

  @ApiProperty({ example: '11999999999', required: false })
  ownerPhone?: string | null;
}
