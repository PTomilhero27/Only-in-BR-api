/**
 * RegisterDto
 * DTO responsável por validar os dados necessários para criação de um usuário.
 *
 * Decisão:
 * - Centralizar validações básicas aqui (DTO) para evitar dados inválidos na regra de negócio.
 * - Documentar com Swagger (descrição + exemplo) para facilitar o consumo pelo front.
 * - Mensagens de erro explícitas para melhorar DX (Developer Experience).
 *
 * Obs:
 * - Em produção, o endpoint /auth/register será restrito ou removido
 *   (ex: apenas seed/admin cria usuários).
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Nome completo do usuário.',
    example: 'Administrador do Sistema',
  })
  @IsString({ message: 'O nome deve ser um texto.' })
  name: string;

  @ApiProperty({
    description: 'E-mail do usuário. Deve ser único no sistema.',
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
  @MinLength(6, {
    message: 'A senha deve ter no mínimo 6 caracteres.',
  })
  password: string;
}
