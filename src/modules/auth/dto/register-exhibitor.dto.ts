/**
 * RegisterExhibitorDto
 *
 * Responsabilidade:
 * - Validar dados mínimos para cadastro do expositor no portal
 * - Espelha o cadastro inicial do front (Step 1 + senha)
 *
 * Observações:
 * - Endereço e financeiro NÃO entram aqui (serão editados no painel depois)
 * - Documento e telefone chegam normalizados ou serão normalizados no service
 */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
} from 'class-validator';

export class RegisterExhibitorDto {
  @ApiProperty({
    description: 'CPF ou CNPJ do expositor (somente dígitos).',
    example: '12345678901',
  })
  @IsString({ message: 'O documento deve ser um texto.' })
  document: string;

  @ApiProperty({
    description: 'Nome completo (PF) ou Razão social (PJ).',
    example: 'Maria da Silva',
  })
  @IsString({ message: 'O nome deve ser um texto.' })
  fullName: string;

  @ApiProperty({
    description: 'E-mail de acesso do expositor.',
    example: 'expositor@teste.com',
  })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty({
    description: 'Telefone do expositor (somente dígitos).',
    example: '11999999999',
  })
  @IsString({ message: 'O telefone deve ser um texto.' })
  phone: string;

  @ApiProperty({
    description: 'Descrição livre da operação/barraca.',
    example: 'Food truck de hambúrguer artesanal.',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'A descrição deve ser um texto.' })
  stallsDescription?: string;

  @ApiProperty({
    description: 'Senha de acesso do expositor.',
    example: '123456',
    minLength: 6,
  })
  @IsString({ message: 'A senha deve ser um texto.' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  password: string;
}
