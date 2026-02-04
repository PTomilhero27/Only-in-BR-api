import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

/**
 * Querystring para link de barraca.
 *
 * Por que existe:
 * - Quando há múltiplas compras do mesmo tamanho,
 *   o expositor pode escolher qual linha (purchase) será consumida.
 *
 * Exemplo:
 * POST /exhibitor/fairs/:fairId/stalls/:stallId?purchaseId=...
 */
export class LinkStallQueryDto {
  @ApiPropertyOptional({
    example: 'ckx9p3z5p0001q8l1p2abcxyz',
    description:
      'ID de uma compra (OwnerFairPurchase) específica para ser consumida. Se ausente, o backend escolhe automaticamente a primeira disponível do mesmo tamanho.',
  })
  @IsOptional()
  @IsString()
  purchaseId?: string
}
