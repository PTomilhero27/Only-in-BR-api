// src/modules/stalls/dto/stall-list-item.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { StallSize, StallType } from '@prisma/client'

/**
 * Item de listagem de barraca (resumo).
 *
 * Responsabilidade:
 * - Entregar dados suficientes para UI (lista/tabela).
 * - Evitar payload pesado (menu/equipamentos completos) na listagem.
 */
export class StallListItemDto {
  @ApiProperty({ example: 'cku123...', description: 'ID da barraca.' })
  @IsString({ message: 'id deve ser string' })
  id!: string

  @ApiProperty({ example: 'Pastel do Zé', description: 'Nome do PDV.' })
  @IsString({ message: 'pdvName deve ser string' })
  pdvName!: string

  @ApiProperty({ example: 2, description: 'Quantidade de maquinhas (machinesQty).' })
  @IsInt({ message: 'machinesQty deve ser inteiro' })
  @Min(0, { message: 'machinesQty deve ser >= 0' })
  machinesQty!: number

  @ApiPropertyOptional({
    example: 'Pastel do Zé',
    nullable: true,
    description: 'Nome do banner (opcional).',
  })
  @IsOptional()
  @IsString({ message: 'bannerName deve ser string' })
  bannerName!: string | null

  @ApiPropertyOptional({
    example: 'Salgados',
    nullable: true,
    description: 'Categoria principal (opcional).',
  })
  @IsOptional()
  @IsString({ message: 'mainCategory deve ser string' })
  mainCategory!: string | null

  @ApiProperty({
    enum: StallType,
    example: StallType.OPEN,
    description: 'Tipo da barraca (OPEN/CLOSED/TRAILER).',
  })
  @IsEnum(StallType, { message: 'stallType inválido' })
  stallType!: StallType

  @ApiProperty({
    enum: StallSize,
    example: StallSize.SIZE_3X3,
    description:
      'Tamanho da barraca. Regra de negócio no service: se stallType=TRAILER, stallSize deve ser TRAILER.',
  })
  @IsEnum(StallSize, { message: 'stallSize inválido' })
  stallSize!: StallSize

  @ApiProperty({ example: 4, description: 'Qtd pessoas na equipe.' })
  @IsInt({ message: 'teamQty deve ser inteiro' })
  @Min(1, { message: 'teamQty deve ser >= 1' })
  teamQty!: number

  @ApiProperty({
    example: '2026-01-29T22:10:00.000Z',
    description: 'Criado em (ISO).',
  })
  @IsString({ message: 'createdAt deve ser string ISO' })
  createdAt!: string

  @ApiProperty({
    example: '2026-01-29T22:10:00.000Z',
    description: 'Atualizado em (ISO).',
  })
  @IsString({ message: 'updatedAt deve ser string ISO' })
  updatedAt!: string
}
