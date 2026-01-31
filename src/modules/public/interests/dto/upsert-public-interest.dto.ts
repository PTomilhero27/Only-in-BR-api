import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PersonType } from '@prisma/client';

/**
 * UpsertPublicInterestDto
 *
 * Responsabilidade:
 * - Validar payload do cadastro inicial do interessado (sem login).
 *
 * Decisão:
 * - Mantemos validação mínima para UX e segurança.
 * - Document/phone devem chegar normalizados (somente dígitos) idealmente,
 *   mas ainda normalizamos no service por defesa.
 */
export class UpsertPublicInterestDto {
  @ApiProperty({ enum: PersonType, example: 'PF' })
  @IsEnum(PersonType, { message: 'personType deve ser PF ou PJ.' })
  personType: PersonType;

  @ApiProperty({ description: 'CPF/CNPJ (pode vir com máscara).', example: '123.456.789-00' })
  @IsString({ message: 'document deve ser um texto.' })
  @MinLength(11, { message: 'document deve ter pelo menos 11 caracteres.' })
  document: string;

  @ApiProperty({ description: 'Nome (PF) / Razão social (PJ).', example: 'Maria da Silva' })
  @IsString({ message: 'fullName deve ser um texto.' })
  @MinLength(3, { message: 'fullName deve ter pelo menos 3 caracteres.' })
  fullName: string;

  @ApiProperty({ description: 'E-mail de contato.', example: 'email@exemplo.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty({ description: 'Telefone (pode vir com máscara).', example: '(11) 99999-9999' })
  @IsString({ message: 'phone deve ser um texto.' })
  phone: string;

  @ApiProperty({
    description: 'Descrição breve da operação.',
    example: 'Hambúrguer artesanal, chapa elétrica, precisa de ponto 220v.',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'stallsDescription deve ser um texto.' })
  stallsDescription?: string;
}
