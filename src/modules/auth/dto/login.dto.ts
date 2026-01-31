/**
 * LoginDto
 * Dados necessários para autenticação do usuário.
 *
 * Decisão:
 * - Validar formato e tamanho aqui (DTO) para evitar chegar lixo na regra de negócio.
 * - Documentar com Swagger (exemplo + descrição) para facilitar o consumo pelo front.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail do usuário cadastrado no sistema.',
    example: 'admin@teste.com',
  })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty({
    description: 'Senha do usuário. Mínimo de 6 caracteres.',
    example: '123456',
    minLength: 6,
  })
  @IsString({ message: 'A senha deve ser um texto.' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  password: string;
}
