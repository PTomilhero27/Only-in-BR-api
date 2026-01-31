// src/modules/stalls/dto/delete-stall-params.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

/**
 * DTO para params de exclusão de barraca.
 *
 * Responsabilidade:
 * - Validar o parâmetro stallId.
 */
export class DeleteStallParamsDto {
  @ApiProperty({ example: 'stall_123', description: 'ID da barraca a excluir.' })
  @IsString({ message: 'stallId deve ser uma string' })
  stallId!: string
}
