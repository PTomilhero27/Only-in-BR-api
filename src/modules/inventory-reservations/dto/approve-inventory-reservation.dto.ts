import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

/**
 * Quantidade aprovada por item.
 * Quando ausente, o service aprova a quantidade solicitada.
 */
export class ApproveInventoryReservationItemDto {
  @ApiProperty({ example: 'b6a0d7ab-7c27-4dfc-bc92-f36d9b35e7d4' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  approvedQty!: number;
}

/**
 * DTO de aprovacao de reserva.
 * Permite aprovar parcialmente antes de bloquear disponibilidade.
 */
export class ApproveInventoryReservationDto {
  @ApiPropertyOptional({ type: [ApproveInventoryReservationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApproveInventoryReservationItemDto)
  items?: ApproveInventoryReservationItemDto[];

  @ApiPropertyOptional({ example: 'Aprovado com reducao de bebidas.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
