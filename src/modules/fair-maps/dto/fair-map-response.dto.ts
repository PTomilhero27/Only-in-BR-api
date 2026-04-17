import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MapElementType, MarketplaceSlotStatus } from '@prisma/client';

/**
 * DTOs de resposta “prontos para o front”.
 * A ideia é o front renderizar o template e aplicar os vínculos por slotClientKey.
 */

export class FairMapTemplateElementDto {
  @ApiProperty({ example: 'el_a1b2c3' })
  clientKey!: string;

  @ApiProperty({ enum: MapElementType, example: MapElementType.BOOTH_SLOT })
  type!: MapElementType;

  @ApiProperty({ example: 100 })
  x!: number;

  @ApiProperty({ example: 200 })
  y!: number;

  @ApiProperty({ example: 0 })
  rotation!: number;

  @ApiProperty({ required: false, example: 44, nullable: true })
  width?: number | null;

  @ApiProperty({ required: false, example: 32, nullable: true })
  height?: number | null;

  @ApiProperty({ required: false, example: 'Palco', nullable: true })
  label?: string | null;

  @ApiProperty({ required: false, example: 12, nullable: true })
  number?: number | null;

  @ApiProperty({ required: false, example: [10, 10, 200, 200], nullable: true })
  points?: any;

  @ApiProperty({ required: false, example: 14, nullable: true })
  radius?: number | null;

  @ApiProperty({
    example: {
      fill: '#CBD5E1',
      stroke: '#0F172A',
      strokeWidth: 2,
      opacity: 0.8,
    },
  })
  style!: any;

  @ApiProperty({ example: true })
  isLinkable!: boolean;
}

export class FairMapTemplateDto {
  @ApiProperty({ example: 'ckv_template_123' })
  id!: string;

  @ApiProperty({ example: 'Planta Praça Central - 2026' })
  title!: string;

  @ApiProperty({ required: false, example: '/maps/praca.png', nullable: true })
  backgroundUrl?: string | null;

  @ApiProperty({ example: 2000 })
  worldWidth!: number;

  @ApiProperty({ example: 1200 })
  worldHeight!: number;

  @ApiProperty({ example: 3 })
  version!: number;

  @ApiProperty({ type: [FairMapTemplateElementDto] })
  elements!: FairMapTemplateElementDto[];
}

/**
 * ✅ Payload “operacional” mínimo para o modal (sem precisar de outra API).
 * Representa a StallFair (barraca vinculada financeiramente à feira).
 */
export class FairMapLinkedStallFairDto {
  @ApiProperty({ example: 'ckv_stallfair_123' })
  id!: string;

  @ApiProperty({ example: 'Pastel do Zé' })
  stallPdvName!: string;

  @ApiProperty({ example: 'SIZE_3X3' })
  stallSize!: string;

  @ApiProperty({ example: 'João da Silva' })
  ownerName!: string;

  @ApiPropertyOptional({ example: '11999999999', nullable: true })
  ownerPhone?: string | null;
}

export class FairMapBoothLinkResponseDto {
  @ApiProperty({ example: 'el_slot_12' })
  slotClientKey!: string;

  @ApiProperty({ example: 'ckv_stallfair_123' })
  stallFairId!: string;

  /**
   * ✅ Opcional para manter compatibilidade e reduzir chamadas no front.
   * - Quando presente, o modal já consegue renderizar dados da barraca.
   */
  @ApiPropertyOptional({ type: FairMapLinkedStallFairDto, nullable: true })
  stallFair?: FairMapLinkedStallFairDto | null;
}

export class FairMapSlotReservationResponseDto {
  @ApiProperty({ example: 'ckv_res_123' })
  id!: string;

  @ApiProperty({ example: 'João da Silva' })
  ownerName!: string;

  @ApiPropertyOptional({ example: '11999999999', nullable: true })
  ownerPhone?: string | null;

  @ApiProperty({ example: 'SIZE_3X3' })
  selectedTentType!: string;

  @ApiProperty({ example: 15000 })
  priceCents!: number;

  @ApiProperty({ example: '2026-04-05T12:00:00Z' })
  expiresAt!: string;
}

export class FairMapSlotResponseDto {
  @ApiProperty({ example: 'ckv_slot_123' })
  id!: string;

  @ApiProperty({ example: 'el_slot_12' })
  fairMapElementId!: string;

  @ApiPropertyOptional({ example: 'A-12', nullable: true })
  code?: string | null;

  @ApiPropertyOptional({ example: 'Vaga 12', nullable: true })
  label?: string | null;

  @ApiProperty({ example: 15000 })
  priceCents!: number;

  @ApiProperty({ enum: MarketplaceSlotStatus, example: MarketplaceSlotStatus.AVAILABLE })
  commercialStatus!: MarketplaceSlotStatus;

  @ApiProperty({ example: true })
  isPublic!: boolean;

  @ApiPropertyOptional({ example: 'Perto da entrada', nullable: true })
  notes?: string | null;

  @ApiProperty({ type: [FairMapSlotReservationResponseDto] })
  reservations!: FairMapSlotReservationResponseDto[];
}

export class FairMapResponseDto {
  @ApiProperty({ example: 'fair_123' })
  fairId!: string;

  @ApiProperty({ example: 'ckv_fairmap_123' })
  fairMapId!: string;

  @ApiProperty({ type: FairMapTemplateDto })
  template!: FairMapTemplateDto;

  @ApiProperty({ type: [FairMapBoothLinkResponseDto] })
  links!: FairMapBoothLinkResponseDto[];

  @ApiProperty({ type: [FairMapSlotResponseDto] })
  slots!: FairMapSlotResponseDto[];
}
