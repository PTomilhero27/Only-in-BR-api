import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

/**
 * Response simples para confirmar desvínculo.
 */
export class UnlinkStallResponseDto {
  @ApiProperty({
    description: 'Indica se a operação foi concluída com sucesso.',
    example: true,
  })
  @IsBoolean()
  ok: boolean
}
