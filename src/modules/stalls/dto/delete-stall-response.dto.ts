// src/modules/stalls/dto/delete-stall-response.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

/**
 * Resposta padrão para exclusão.
 */
export class DeleteStallResponseDto {
  @ApiProperty({ example: true, description: 'Indica sucesso da operação.' })
  @IsBoolean({ message: 'ok deve ser boolean' })
  ok!: boolean
}
