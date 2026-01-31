import { ApiProperty } from '@nestjs/swagger'
import { PasswordTokenType } from '@prisma/client'

/**
 * Motivo de falha ao validar token.
 * Motivo: o front precisa diferenciar "expirou" vs "já usado" vs "inválido".
 */
export enum ValidateTokenFailureReason {
  INVALID = 'INVALID',
  EXPIRED = 'EXPIRED',
  USED = 'USED',
}

export class ValidateTokenResponseDto {
  /**
   * Quando ok=true, temos contexto para o fluxo.
   * Quando ok=false, reason explica o motivo.
   */
  @ApiProperty()
  ok!: boolean

  @ApiProperty({ enum: ValidateTokenFailureReason, required: false })
  reason?: ValidateTokenFailureReason

  @ApiProperty({ required: false })
  ownerId?: string

  @ApiProperty({ enum: PasswordTokenType, required: false })
  tokenType?: PasswordTokenType

  @ApiProperty({ required: false })
  expiresAt?: string

  @ApiProperty({ required: false, nullable: true })
  email?: string | null

  @ApiProperty({ required: false, nullable: true })
  displayName?: string | null
}
