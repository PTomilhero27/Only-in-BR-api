import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

/**
 * Response simples para ação de vincular.
 */
export class LinkStallResponseDto {
  @ApiProperty({ example: true, description: 'Indica sucesso da operação.' })
  @IsBoolean()
  ok!: boolean
}
