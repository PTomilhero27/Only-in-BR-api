import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { FairStatus, OwnerFairStatus } from '@prisma/client'

import { ExhibitorFairStallSlotDto } from './exhibitor-fair-stall-slot.dto'
import { ExhibitorFairLinkedStallDto } from './exhibitor-fair-linked-stall.dto'
import { ExhibitorFairPaymentSummaryDto } from './exhibitor-fair-payment-summary.dto'

/**
 * Item da lista de feiras do expositor (para a tela).
 *
 * Responsabilidade:
 * - Traz tudo que o front precisa para renderizar a experiência do usuário:
 *   - dados da feira (nome/status)
 *   - status do expositor na feira (OwnerFair.status)
 *   - compra por tamanho (slots)
 *   - barracas já vinculadas
 *   - ✅ resumo do pagamento (plano/parcelas/status)
 *
 * Decisão:
 * - payment pode ser null/undefined se ainda não houver plano criado no admin.
 */
export class ExhibitorFairListItemDto {
  @ApiProperty({ description: 'ID da feira.' })
  @IsString()
  fairId: string

  @ApiProperty({ description: 'Nome da feira.', example: 'Feira Gastronômica Only in BR - Janeiro' })
  @IsString()
  fairName: string

  @ApiProperty({
    enum: FairStatus,
    description: 'Status administrativo da feira.',
    example: 'ATIVA',
  })
  @IsEnum(FairStatus)
  fairStatus: FairStatus

  @ApiProperty({
    enum: OwnerFairStatus,
    description: 'Status operacional do expositor dentro da feira.',
    example: 'SELECIONADO',
  })
  @IsEnum(OwnerFairStatus)
  ownerFairStatus: OwnerFairStatus

  @ApiProperty({
    description: 'Quantidade total de barracas compradas nesta feira.',
    example: 3,
  })
  @IsInt()
  @Min(0)
  stallsQtyPurchased: number

  @ApiProperty({
    type: [ExhibitorFairStallSlotDto],
    description: 'Compra detalhada por tamanho (slots).',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExhibitorFairStallSlotDto)
  stallSlots: ExhibitorFairStallSlotDto[]

  @ApiProperty({
    description: 'Quantidade de barracas já vinculadas nesta feira.',
    example: 2,
  })
  @IsInt()
  @Min(0)
  stallsLinkedQty: number

  @ApiProperty({
    type: [ExhibitorFairLinkedStallDto],
    description: 'Barracas já vinculadas pelo expositor nesta feira.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExhibitorFairLinkedStallDto)
  linkedStalls: ExhibitorFairLinkedStallDto[]

  @ApiPropertyOptional({
    type: ExhibitorFairPaymentSummaryDto,
    description:
      'Resumo do pagamento do expositor nesta feira (parcelas, status, total, próxima data). Pode ser null se não existir plano.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExhibitorFairPaymentSummaryDto)
  payment?: ExhibitorFairPaymentSummaryDto | null
}
