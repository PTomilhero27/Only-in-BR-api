import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * ResendVerificationDto
 *
 * Responsabilidade:
 * - Validar payload de reenvio de código de verificação.
 */
export class ResendVerificationDto {
  @ApiProperty({
    description: 'E-mail cadastrado no formulário público.',
    example: 'email@exemplo.com',
  })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;
}
