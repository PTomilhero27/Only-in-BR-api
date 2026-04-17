import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * ForgotPasswordDto
 *
 * Responsabilidade:
 * - Validar payload de recuperação de senha do expositor.
 *
 * Decisão de segurança:
 * - Sempre retornamos mensagem genérica (não vazar se email existe).
 */
export class ForgotPasswordDto {
  @ApiProperty({
    description: 'E-mail do expositor.',
    example: 'expositor@exemplo.com',
  })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;
}
