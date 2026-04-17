import { ApiProperty } from '@nestjs/swagger';

/**
 * ForgotPasswordResponseDto
 *
 * Decisão de segurança:
 * - Mensagem genérica para não vazar se o email existe ou não no sistema.
 */
export class ForgotPasswordResponseDto {
  @ApiProperty({
    example:
      'Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.',
  })
  message: string;
}
