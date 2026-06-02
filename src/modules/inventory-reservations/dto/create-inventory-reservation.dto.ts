import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Item solicitado dentro de uma reserva em lote.
 * Cada item so pode aparecer uma vez na mesma reserva.
 */
export class CreateInventoryReservationItemDto {
  @ApiProperty({ example: 'b6a0d7ab-7c27-4dfc-bc92-f36d9b35e7d4' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: 40 })
  @IsInt()
  @Min(1)
  requestedQty!: number;

  @ApiPropertyOptional({ example: 'Separar caixas fechadas quando possivel.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/**
 * DTO de criacao de reserva.
 * Permite vincular a uma feira ou, sem feira, exige finalidade no service para manter rastreabilidade.
 */
export class CreateInventoryReservationDto {
  @ApiPropertyOptional({ example: '6e7cb313-46c4-4d98-94be-3d8e480c13f5' })
  @IsOptional()
  @IsUUID()
  fairId?: string;

  @ApiPropertyOptional({ example: 'Separacao avulsa para treinamento da equipe.' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  purpose?: string;

  @ApiPropertyOptional({ example: 'Maria Souza' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  responsibleName?: string;

  @ApiPropertyOptional({ example: '2026-05-20T14:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expectedPickupAt?: string;

  @ApiPropertyOptional({ example: 'Separar na semana do evento.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ type: [CreateInventoryReservationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryReservationItemDto)
  items!: CreateInventoryReservationItemDto[];
}
