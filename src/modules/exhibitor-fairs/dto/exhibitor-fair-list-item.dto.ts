import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { FairStatus, OwnerFairStatus } from '@prisma/client'
import { IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

import { ExhibitorFairPaymentSummaryDto } from './exhibitor-fair-payment-summary.dto'
import { ExhibitorFairContractSummaryDto } from './exhibitor-fair-contract-summary.dto'
import { ExhibitorFairPurchaseDto } from './exhibitor-fair-purchase.dto'
import { ExhibitorLinkedStallDto } from './exhibitor-linked-stall.dto'

/**
 * Item da listagem "Minhas Feiras" no Portal do Expositor.
 *
 * Responsabilidade:
 * - Entregar ao front tudo que é necessário para renderizar:
 *   - status operacional do expositor (OwnerFairStatus)
 *   - contrato (status/link/pdf)
 *   - compras (linhas) + consumo (usedQty)
 *   - barracas vinculadas (StallFair) + purchase consumida
 *   - resumo agregado de pagamentos
 */
export class ExhibitorFairListItemDto {
  @ApiProperty({ example: '5c4b9a3a-2d13-4c8b-9a4e-7d4f6a7e8b9c', description: 'ID da feira.' })
  @IsString()
  fairId!: string

  @ApiProperty({ example: 'Feira Gastronômica Only in BR', description: 'Nome da feira.' })
  @IsString()
  fairName!: string

  @ApiProperty({ enum: FairStatus, example: FairStatus.ATIVA, description: 'Status da feira.' })
  @IsEnum(FairStatus)
  fairStatus!: FairStatus

  @ApiProperty({
    enum: OwnerFairStatus,
    example: OwnerFairStatus.SELECIONADO,
    description: 'Status operacional do expositor na feira.',
  })
  @IsEnum(OwnerFairStatus)
  ownerFairStatus!: OwnerFairStatus

  @ApiProperty({
    example: 3,
    description: 'Quantidade total comprada/reservada (stallsQty no OwnerFair).',
  })
  @IsInt()
  @Min(0)
  stallsQtyPurchased!: number

  @ApiProperty({ example: 1, description: 'Quantidade de barracas já vinculadas (StallFair).' })
  @IsInt()
  @Min(0)
  stallsLinkedQty!: number

  @ApiPropertyOptional({
    type: ExhibitorFairContractSummaryDto,
    description: 'Resumo do contrato desta feira (por expositor).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExhibitorFairContractSummaryDto)
  contract!: ExhibitorFairContractSummaryDto | null

  @ApiProperty({
    type: [ExhibitorFairPurchaseDto],
    description:
      'Compras (linhas) registradas no Admin. O portal consome linha por linha ao vincular barracas.',
  })
  @ValidateNested({ each: true })
  @Type(() => ExhibitorFairPurchaseDto)
  purchases!: ExhibitorFairPurchaseDto[]

  @ApiProperty({
    type: [ExhibitorLinkedStallDto],
    description: 'Barracas vinculadas nesta feira (cada uma consome uma compra).',
  })
  @ValidateNested({ each: true })
  @Type(() => ExhibitorLinkedStallDto)
  linkedStalls!: ExhibitorLinkedStallDto[]

  @ApiPropertyOptional({
    type: ExhibitorFairPaymentSummaryDto,
    description: 'Resumo agregado de pagamento por feira (derivado das compras e parcelas).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExhibitorFairPaymentSummaryDto)
  paymentSummary!: ExhibitorFairPaymentSummaryDto | null
}
