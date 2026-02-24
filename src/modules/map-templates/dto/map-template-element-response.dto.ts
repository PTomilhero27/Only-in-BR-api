import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MapElementType } from "@prisma/client";
import { MapElementStyleDto } from "./map-template-style.dto";

/**
 * MapTemplateElementResponseDto
 *
 * Representa 1 elemento retornado pela API.
 * Importante:
 * - Este DTO representa APENAS o elemento
 * - Quem tem `elements` é o template (MapTemplateResponseDto)
 */
export class MapTemplateElementResponseDto {
  @ApiProperty({ example: "ck_xxxxx" })
  id!: string;

  @ApiProperty({ example: "el_abcd123" })
  clientKey!: string;

  @ApiProperty({ enum: MapElementType, example: MapElementType.RECT })
  type!: MapElementType;

  @ApiProperty({ example: 100 })
  x!: number;

  @ApiProperty({ example: 200 })
  y!: number;

  @ApiProperty({ example: 0 })
  rotation!: number;

  @ApiPropertyOptional({ example: 120 })
  width?: number | null;

  @ApiPropertyOptional({ example: 80 })
  height?: number | null;

  @ApiPropertyOptional({ example: "Área" })
  label?: string | null;

  @ApiPropertyOptional({ example: 1 })
  number?: number | null;

  @ApiPropertyOptional({
    type: [Number],
    example: [10, 10, 90, 90],
  })
  points?: number[] | null;

  @ApiPropertyOptional({ example: 18 })
  radius?: number | null;

  @ApiProperty({ type: MapElementStyleDto })
  style!: MapElementStyleDto;

  @ApiProperty({ example: false })
  isLinkable!: boolean;
}