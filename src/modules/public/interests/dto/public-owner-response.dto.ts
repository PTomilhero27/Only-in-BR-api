import { ApiProperty } from '@nestjs/swagger';

/**
 * PublicOwnerResponseDto
 *
 * Responsabilidade:
 * - Retornar uma resposta mínima para o front confirmar que salvou.
 * - ✅ Inclui mensagem informando sobre a verificação de email.
 */
export class PublicOwnerResponseDto {
  @ApiProperty({ example: 'ckx123...' })
  ownerId: string;

  @ApiProperty({
    example: 'Código de verificação enviado para seu email.',
  })
  message: string;
}

