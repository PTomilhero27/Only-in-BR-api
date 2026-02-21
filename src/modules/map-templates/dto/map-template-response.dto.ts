import { ApiProperty } from '@nestjs/swagger';
import { MapElementType } from '@prisma/client';
import { MapTemplateStyleDto } from './map-template-style.dto';

/**
 * DTOs de resposta (Swagger e tipagem explícita).
 * Mantemos resposta estável e clara para o front.
 */
export class MapTemplateElementResponseDto {
  @ApiProperty({ example: 'el_a1b2c3' })
  clientKey!: string;

  @ApiProperty({ enum: MapElementType, example: MapElementType.BOOTH_SLOT })
  type!: MapElementType;

  @ApiProperty({ example: 120.5 })
  x!: number;

  @ApiProperty({ example: 340.2 })
  y!: number;

  @ApiProperty({ example: 0 })
  rotation!: number;

  @ApiProperty({ example: 44, required: false })
  width?: number | null;

  @ApiProperty({ example: 32, required: false })
  height?: number | null;

  @ApiProperty({ example: 'Palco', required: false })
  label?: string | null;

  @ApiProperty({ example: 12, required: false })
  number?: number | null;

  @ApiProperty({ example: [10, 10, 200, 200], required: false })
  points?: number[] | null;

  @ApiProperty({ example: 14, required: false })
  radius?: number | null;

  @ApiProperty({ type: MapTemplateStyleDto })
  style!: MapTemplateStyleDto;

  @ApiProperty({ example: true })
  isLinkable!: boolean;
}

export class MapTemplateResponseDto {
  @ApiProperty({ example: 'ckv_template_123' })
  id!: string;

  @ApiProperty({ example: 'Planta Praça Central - 2026' })
  title!: string;

  @ApiProperty({ example: 'Layout com palco e 40 slots.', required: false })
  description?: string | null;

  @ApiProperty({ example: '/maps/praca-central.png', required: false })
  backgroundUrl?: string | null;

  @ApiProperty({ example: 2000 })
  worldWidth!: number;

  @ApiProperty({ example: 1200 })
  worldHeight!: number;

  @ApiProperty({ example: 3 })
  version!: number;

  @ApiProperty({ type: [MapTemplateElementResponseDto] })
  elements!: MapTemplateElementResponseDto[];

  @ApiProperty({ example: '2026-02-19T12:34:56.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-02-20T10:00:00.000Z' })
  updatedAt!: string;
}
