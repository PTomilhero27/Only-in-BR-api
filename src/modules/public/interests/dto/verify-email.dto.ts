import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

/**
 * VerifyEmailDto
 *
 * Responsabilidade:
 * - Validar payload de verificação de email (código de 6 dígitos).
 */
export class VerifyEmailDto {
  @ApiProperty({
    description: 'E-mail cadastrado no formulário público.',
    example: 'email@exemplo.com',
  })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty({
    description: 'Código de verificação de 6 dígitos enviado por email.',
    example: '482917',
  })
  @IsString({ message: 'code deve ser um texto.' })
  @Length(6, 6, { message: 'code deve ter exatamente 6 dígitos.' })
  code: string;
}
