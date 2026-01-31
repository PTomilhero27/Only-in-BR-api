// src/modules/stalls/dto/update-stall.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'
import { CreateStallDto } from './create-stall.dto'

/**
 * DTO de edição de barraca.
 *
 * Responsabilidade:
 * - Substituir o payload completo (estilo PUT semântico).
 *
 * Decisão:
 * - Mantemos a mesma estrutura de CreateStallDto (stall completo).
 */
export class UpdateStallDto extends CreateStallDto {
  @ApiProperty({
    type: (CreateStallDto as any),
    description: 'Payload completo da barraca (mesmo contrato do create).',
  })
  @ValidateNested()
  @Type(() => Object)
  declare stall: any
}
