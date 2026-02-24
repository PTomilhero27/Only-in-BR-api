import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MapTemplateElementResponseDto } from "./map-template-element-response.dto";

/**
 * MapTemplateResponseDto
 *
 * Representa o template completo retornado pela API.
 * Aqui sim existe `elements`.
 */
export class MapTemplateResponseDto {
  @ApiProperty({ example: "tpl_xxxxx" })
  id!: string;

  @ApiProperty({ example: "Planta Principal" })
  title!: string;

  @ApiPropertyOptional({ example: "Descrição..." })
  description?: string | null;

  @ApiPropertyOptional({ example: "https://..." })
  backgroundUrl?: string | null;

  @ApiProperty({ example: 2000 })
  worldWidth!: number;

  @ApiProperty({ example: 1200 })
  worldHeight!: number;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ type: [MapTemplateElementResponseDto] })
  elements!: MapTemplateElementResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}