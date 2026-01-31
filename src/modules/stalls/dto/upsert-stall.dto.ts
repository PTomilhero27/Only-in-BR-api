// src/modules/stalls/dto/upsert-stall.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import { StallSize, StallType } from '@prisma/client'

/**
 * DTO: PowerNeed (infraestrutura).
 */
class StallPowerNeedDto {
  @ApiProperty({ example: 2, description: 'Quantidade de tomadas 110v.' })
  @IsInt({ message: 'outlets110 deve ser inteiro' })
  @Min(0, { message: 'outlets110 deve ser >= 0' })
  outlets110!: number

  @ApiProperty({ example: 1, description: 'Quantidade de tomadas 220v.' })
  @IsInt({ message: 'outlets220 deve ser inteiro' })
  @Min(0, { message: 'outlets220 deve ser >= 0' })
  outlets220!: number

  @ApiProperty({ example: 0, description: 'Quantidade de tomadas adicionais.' })
  @IsInt({ message: 'outletsOther deve ser inteiro' })
  @Min(0, { message: 'outletsOther deve ser >= 0' })
  outletsOther!: number

  @ApiProperty({ example: false, description: 'Se precisa de gás (GLP).' })
  @IsBoolean({ message: 'needsGas deve ser boolean' })
  needsGas!: boolean

  @ApiPropertyOptional({
    example: 'Uso de botijão P13, precisa área ventilada.',
    description: 'Observações sobre gás.',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'gasNotes deve ser string' })
  gasNotes?: string | null

  @ApiPropertyOptional({
    example: 'Precisa ficar próximo ao ponto de energia.',
    description: 'Observações gerais.',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'notes deve ser string' })
  notes?: string | null
}

/**
 * DTO: Equipamento.
 */
class StallEquipmentDto {
  @ApiProperty({ example: 'Fritadeira elétrica', description: 'Nome do equipamento.' })
  @IsString({ message: 'name deve ser string' })
  name!: string

  @ApiProperty({ example: 2, description: 'Quantidade do equipamento.' })
  @IsInt({ message: 'qty deve ser inteiro' })
  @Min(1, { message: 'qty deve ser >= 1' })
  qty!: number
}

/**
 * DTO: Produto do cardápio.
 */
class StallMenuProductDto {
  @ApiProperty({ example: 'Pastel de carne', description: 'Nome do produto.' })
  @IsString({ message: 'name deve ser string' })
  name!: string

  @ApiProperty({ example: 1500, description: 'Preço em centavos (ex.: 1500 = R$ 15,00).' })
  @IsInt({ message: 'priceCents deve ser inteiro' })
  @Min(0, { message: 'priceCents deve ser >= 0' })
  priceCents!: number

  @ApiPropertyOptional({
    example: 0,
    description: 'Ordem manual (se não vier, o backend define pelo índice).',
  })
  @IsOptional()
  @IsInt({ message: 'order deve ser inteiro' })
  @Min(0, { message: 'order deve ser >= 0' })
  order?: number
}

/**
 * DTO: Categoria do cardápio.
 */
class StallMenuCategoryDto {
  @ApiProperty({ example: 'Pasteis', description: 'Nome da categoria.' })
  @IsString({ message: 'name deve ser string' })
  name!: string

  @ApiPropertyOptional({
    example: 0,
    description: 'Ordem manual (se não vier, o backend define pelo índice).',
  })
  @IsOptional()
  @IsInt({ message: 'order deve ser inteiro' })
  @Min(0, { message: 'order deve ser >= 0' })
  order?: number

  @ApiProperty({ type: [StallMenuProductDto], example: [{ name: 'Pastel de queijo', priceCents: 1200, order: 0 }] })
  @IsArray({ message: 'products deve ser array' })
  @ValidateNested({ each: true })
  @Type(() => StallMenuProductDto)
  products!: StallMenuProductDto[]
}

/**
 * DTO de criação/edição (payload final).
 *
 * Observação:
 * - Regra de negócio do Trailer é aplicada no service:
 *   stallType=TRAILER => stallSize=TRAILER.
 */
export class UpsertStallDto {
  @ApiProperty({ example: 'Pastel do Zé', description: 'Nome do PDV (obrigatório).' })
  @IsString({ message: 'pdvName deve ser string' })
  pdvName!: string

  @ApiProperty({ example: 2, description: 'Quantidade de maquinhas (>= 0).' })
  @IsInt({ message: 'machinesQty deve ser inteiro' })
  @Min(0, { message: 'machinesQty deve ser >= 0' })
  @Max(50, { message: 'machinesQty deve ser <= 50' })
  machinesQty!: number

  @ApiPropertyOptional({ example: 'Pastel do Zé', nullable: true, description: 'Nome do banner (opcional).' })
  @IsOptional()
  @IsString({ message: 'bannerName deve ser string' })
  bannerName?: string | null

  @ApiPropertyOptional({ example: 'Salgados', nullable: true, description: 'Categoria principal (opcional).' })
  @IsOptional()
  @IsString({ message: 'mainCategory deve ser string' })
  mainCategory?: string | null

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
    description: 'Tamanho da barraca (inclui TRAILER).',
  })
  @IsEnum(StallSize, { message: 'stallSize inválido' })
  stallSize!: StallSize

  @ApiProperty({ example: 3, description: 'Qtd pessoas na equipe (>= 1).' })
  @IsInt({ message: 'teamQty deve ser inteiro' })
  @Min(1, { message: 'teamQty deve ser >= 1' })
  @Max(50, { message: 'teamQty deve ser <= 50' })
  teamQty!: number

  @ApiProperty({
    type: StallPowerNeedDto,
    example: { outlets110: 2, outlets220: 1, outletsOther: 0, needsGas: false, gasNotes: null, notes: 'Próximo ao ponto de energia' },
  })
  @ValidateNested()
  @Type(() => StallPowerNeedDto)
  power!: StallPowerNeedDto

  @ApiPropertyOptional({
    type: [StallEquipmentDto],
    example: [{ name: 'Chapa', qty: 1 }, { name: 'Fritadeira', qty: 2 }],
    description: 'Lista de equipamentos (opcional).',
  })
  @IsOptional()
  @IsArray({ message: 'equipments deve ser array' })
  @ValidateNested({ each: true })
  @Type(() => StallEquipmentDto)
  equipments?: StallEquipmentDto[]

  @ApiPropertyOptional({
    type: [StallMenuCategoryDto],
    example: [
      {
        name: 'Pasteis',
        order: 0,
        products: [{ name: 'Pastel de carne', priceCents: 1500, order: 0 }],
      },
    ],
    description: 'Categorias e produtos (opcional).',
  })
  @IsOptional()
  @IsArray({ message: 'categories deve ser array' })
  @ValidateNested({ each: true })
  @Type(() => StallMenuCategoryDto)
  categories?: StallMenuCategoryDto[]
}
