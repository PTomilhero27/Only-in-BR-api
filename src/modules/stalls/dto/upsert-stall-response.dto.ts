// src/modules/stalls/dto/upsert-stall-response.dto.ts
import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

/**
 * Resposta padrão para criação/edição de barraca.
 */
export class UpsertStallResponseDto {
  @ApiProperty({ example: 'cku123...', description: 'ID da barraca criada/editada.' })
  @IsString({ message: 'stallId deve ser string' })
  stallId!: string
}
