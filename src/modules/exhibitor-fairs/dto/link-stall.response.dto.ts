import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

/**
 * Response simples para confirmar vínculo.
 * Ajuda o front a exibir toast e controlar estados.
 */
export class LinkStallResponseDto {
  @ApiProperty({
    description: 'Indica se a operação foi concluída com sucesso.',
    example: true,
  })
  @IsBoolean()
  ok: boolean
}
