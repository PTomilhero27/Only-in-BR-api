import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

/**
 * Response simples para ação de desvincular.
 */
export class UnlinkStallResponseDto {
  @ApiProperty({ example: true, description: 'Indica sucesso da operação.' })
  @IsBoolean()
  ok!: boolean
}
