// src/modules/stalls/dto/create-stall.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import { StallSize, StallType } from '@prisma/client'

/**
 * DTO interno do bloco "PowerNeed" da barraca.
 */
class StallPowerDto {
  @ApiProperty({ example: 2, description: 'Qtd tomadas 110V.' })
  @IsInt({ message: 'outlets110 deve ser inteiro' })
  @Min(0, { message: 'outlets110 deve ser >= 0' })
  outlets110!: number

  @ApiProperty({ example: 1, description: 'Qtd tomadas 220V.' })
  @IsInt({ message: 'outlets220 deve ser inteiro' })
  @Min(0, { message: 'outlets220 deve ser >= 0' })
  outlets220!: number

  @ApiProperty({ example: 0, description: 'Qtd tomadas “outras”/extensões.' })
  @IsInt({ message: 'outletsOther deve ser inteiro' })
  @Min(0, { message: 'outletsOther deve ser >= 0' })
  outletsOther!: number

  @ApiProperty({
    example: true,
    description: 'Se precisa de gás nos equipamentos.',
  })
  @IsBoolean({ message: 'needsGas deve ser boolean' })
  needsGas!: boolean

  @ApiProperty({
    example: 'Uso de botijão P13 (1 unidade)',
    required: false,
    nullable: true,
    description: 'Observações sobre gás (opcional).',
  })
  @IsOptional()
  @IsString({ message: 'gasNotes deve ser string' })
  gasNotes?: string | null

  @ApiProperty({
    example: 'Preferência por ponto próximo ao quadro.',
    required: false,
    nullable: true,
    description: 'Observações gerais (opcional).',
  })
  @IsOptional()
  @IsString({ message: 'notes deve ser string' })
  notes?: string | null
}

class StallEquipmentDto {
  @ApiProperty({ example: 'Chapa', description: 'Nome do equipamento.' })
  @IsString({ message: 'name deve ser string' })
  @IsNotEmpty({ message: 'name é obrigatório' })
  name!: string

  @ApiProperty({ example: 1, description: 'Quantidade do equipamento.' })
  @IsInt({ message: 'qty deve ser inteiro' })
  @Min(1, { message: 'qty deve ser >= 1' })
  @Max(99, { message: 'qty deve ser <= 99' })
  qty!: number
}

class StallMenuProductDto {
  @ApiProperty({ example: 'Pastel de carne', description: 'Nome do produto.' })
  @IsString({ message: 'name deve ser string' })
  @IsNotEmpty({ message: 'name é obrigatório' })
  name!: string

  @ApiProperty({
    example: 1500,
    description: 'Preço em centavos (ex.: R$15,00 => 1500).',
  })
  @IsInt({ message: 'priceCents deve ser inteiro' })
  @Min(0, { message: 'priceCents deve ser >= 0' })
  priceCents!: number

  @ApiProperty({
    example: 0,
    required: false,
    description: 'Ordem do produto na lista (opcional).',
  })
  @IsOptional()
  @IsInt({ message: 'order deve ser inteiro' })
  @Min(0, { message: 'order deve ser >= 0' })
  order?: number
}

class StallMenuCategoryDto {
  @ApiProperty({ example: 'Salgados', description: 'Nome da categoria.' })
  @IsString({ message: 'name deve ser string' })
  @IsNotEmpty({ message: 'name é obrigatório' })
  name!: string

  @ApiProperty({
    example: 0,
    required: false,
    description: 'Ordem da categoria (opcional).',
  })
  @IsOptional()
  @IsInt({ message: 'order deve ser inteiro' })
  @Min(0, { message: 'order deve ser >= 0' })
  order?: number

  @ApiProperty({
    type: [StallMenuProductDto],
    example: [
      { name: 'Pastel de carne', priceCents: 1500, order: 0 },
      { name: 'Pastel de queijo', priceCents: 1400, order: 1 },
    ],
    description: 'Produtos da categoria.',
  })
  @IsArray({ message: 'products deve ser um array' })
  @ValidateNested({ each: true })
  @Type(() => StallMenuProductDto)
  products!: StallMenuProductDto[]
}

/**
 * Payload completo da barraca (equivalente ao “submit final” do wizard).
 */
class StallPayloadDto {
  @ApiProperty({ example: 'Pastel do Zé', description: 'Nome do PDV.' })
  @IsString({ message: 'pdvName deve ser string' })
  @IsNotEmpty({ message: 'pdvName é obrigatório' })
  pdvName!: string

  @ApiProperty({
    example: 2,
    description: 'Quantidade de maquinhas (fixo na entidade Stall).',
  })
  @IsInt({ message: 'machinesQty deve ser inteiro' })
  @Min(0, { message: 'machinesQty deve ser >= 0' })
  @Max(99, { message: 'machinesQty deve ser <= 99' })
  machinesQty!: number

  @ApiProperty({
    example: 'Pastel do Zé',
    required: false,
    nullable: true,
    description: 'Nome do banner (opcional).',
  })
  @IsOptional()
  @IsString({ message: 'bannerName deve ser string' })
  bannerName?: string | null

  @ApiProperty({
    example: 'Salgados',
    required: false,
    nullable: true,
    description: 'Categoria principal (opcional).',
  })
  @IsOptional()
  @IsString({ message: 'mainCategory deve ser string' })
  mainCategory?: string | null

  @ApiProperty({
    enum: StallType,
    example: StallType.OPEN,
    description: 'Tipo: BARRACA/TRAILER etc.',
  })
  @IsEnum(StallType, { message: 'stallType inválido' })
  stallType!: StallType

  @ApiProperty({
    enum: StallSize,
    example: StallSize.SIZE_3X3,
    description:
      'Tamanho. Regra de negócio: se stallType=TRAILER, o backend força stallSize=TRAILER.',
  })
  @IsEnum(StallSize, { message: 'stallSize inválido' })
  stallSize!: StallSize

  @ApiProperty({ example: 4, description: 'Qtd pessoas na equipe.' })
  @IsInt({ message: 'teamQty deve ser inteiro' })
  @Min(1, { message: 'teamQty deve ser >= 1' })
  @Max(99, { message: 'teamQty deve ser <= 99' })
  teamQty!: number

  @ApiProperty({ type: StallPowerDto, description: 'Necessidades de energia/gás.' })
  @ValidateNested()
  @Type(() => StallPowerDto)
  power!: StallPowerDto

  @ApiProperty({
    type: [StallEquipmentDto],
    required: false,
    example: [{ name: 'Chapa', qty: 1 }],
    description: 'Lista de equipamentos (opcional).',
  })
  @IsOptional()
  @IsArray({ message: 'equipments deve ser um array' })
  @ValidateNested({ each: true })
  @Type(() => StallEquipmentDto)
  equipments?: StallEquipmentDto[]

  @ApiProperty({
    type: [StallMenuCategoryDto],
    required: false,
    description: 'Categorias do cardápio (opcional).',
    example: [
      {
        name: 'Salgados',
        order: 0,
        products: [{ name: 'Pastel de carne', priceCents: 1500, order: 0 }],
      },
    ],
  })
  @IsOptional()
  @IsArray({ message: 'categories deve ser um array' })
  @ValidateNested({ each: true })
  @Type(() => StallMenuCategoryDto)
  categories?: StallMenuCategoryDto[]
}

/**
 * DTO de criação de barraca (autenticado).
 *
 * Responsabilidade:
 * - Receber payload final do wizard.
 *
 * Decisão:
 * - Sem document no payload (owner vem do JWT).
 */
export class CreateStallDto {
  @ApiProperty({
    type: StallPayloadDto,
    description: 'Payload completo da barraca.',
  })
  @ValidateNested()
  @Type(() => StallPayloadDto)
  stall!: StallPayloadDto
}
