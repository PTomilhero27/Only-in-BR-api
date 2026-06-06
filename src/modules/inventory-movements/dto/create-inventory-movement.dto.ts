import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryMovementType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, NotEquals } from 'class-validator';

/**
 * DTO de movimentacao manual.
 * Aceita apenas eventos administrativos sem reserva; reservas geram movimentos pelos proprios fluxos.
 */
export class CreateInventoryMovementDto {
  @ApiProperty({
    enum: [InventoryMovementType.IN, InventoryMovementType.OUT, InventoryMovementType.ADJUSTMENT, InventoryMovementType.DAMAGE],
    example: InventoryMovementType.IN,
  })
  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @ApiProperty({ example: 25, description: 'Quantidade movimentada. Ajuste pode ser negativo.' })
  @IsInt()
  @NotEquals(0)
  quantity!: number;

  @ApiProperty({ example: 'Reposicao manual comprada no atacado.' })
  @IsString()
  @MaxLength(2000)
  notes!: string;

  @ApiPropertyOptional({ example: 'feira_id' })
  @IsOptional()
  @IsUUID()
  fairId?: string;

  @ApiPropertyOptional({ example: 'Uso avulso para equipe de montagem.' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  purpose?: string;

  @ApiPropertyOptional({ example: false, description: 'Indica se esta saida exige devolucao posterior.' })
  @IsOptional()
  @IsBoolean()
  requiresReturn?: boolean;

  @ApiPropertyOptional({ example: 'Joao da Silva', description: 'Nome da pessoa que retirou o material.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsibleName?: string;
}
