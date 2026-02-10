import { ApiProperty } from '@nestjs/swagger'

/**
 * Resposta do admin ao gerar um token de reset de senha do expositor.
 *
 * Observação:
 * - O `token` bruto só existe aqui (não é salvo no banco).
 * - No banco guardamos apenas `tokenHash`.
 */
export class CreateExhibitorPasswordResetTokenResponseDto {
  @ApiProperty({ example: 'kO3m0cYJp9Jc... (token bruto)' })
  token!: string

  @ApiProperty({ example: '2026-02-10T15:30:00.000Z' })
  expiresAt!: string

  @ApiProperty({
    example: 'https://portal.onlyinbr.com/resetar-senha?token=TOKEN_AQUI',
  })
  resetUrl!: string
}
