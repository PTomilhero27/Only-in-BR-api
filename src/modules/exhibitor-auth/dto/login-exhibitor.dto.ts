import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength } from 'class-validator'

/**
 * DTO de login do expositor.
 *
 * Responsabilidade:
 * - Receber credenciais (email + senha)
 *
 * Decisão:
 * - Senha mínimo 8 (alinhado ao front).
 * - E-mail obrigatório porque o portal usa o e-mail como login.
 */
export class LoginExhibitorDto {
  @ApiProperty({
    example: 'feirante@exemplo.com',
    description: 'E-mail usado como login do expositor.',
  })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string

  @ApiProperty({
    example: 'MinhaSenha@123',
    description: 'Senha do expositor (mínimo 8 caracteres).',
  })
  @IsString({ message: 'password deve ser string.' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  password: string
}
