/**
 * DTO para atualizar o perfil do expositor (Owner) autenticado.
 *
 * Regras:
 * - NÃO aceitamos: document, email, personType (somente leitura no portal).
 * - Atualiza somente campos que existem no schema atual do Prisma.
 *
 * Decisão:
 * - name é obrigatório para manter “cadastro completo”.
 * - Os demais campos são opcionais/nullable (o usuário pode preencher aos poucos).
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { BankAccountType } from '@prisma/client';

export class UpdateOwnerMeDto {
  // -----------------------
  // Dados pessoais
  // -----------------------

  @ApiProperty({
    example: 'Empresa do João LTDA',
    description: 'Nome (PF) ou Razão Social (PJ).',
  })
  @IsString({ message: 'name deve ser string.' })
  @Length(2, 200, { message: 'name deve ter entre 2 e 200 caracteres.' })
  name: string;

  @ApiPropertyOptional({ example: '11999999999', nullable: true, description: 'Somente dígitos.' })
  @IsOptional()
  @IsString({ message: 'phone deve ser string.' })
  @Matches(/^\d{10,13}$/, { message: 'phone deve conter entre 10 e 13 dígitos.' })
  phone?: string | null;

  @ApiPropertyOptional({
    example: 'Barraca de batata + pastel; também vendo caldo de cana.',
    nullable: true,
    description: 'Descrição livre das barracas/produtos.',
  })
  @IsOptional()
  @IsString({ message: 'stallsDescription deve ser string.' })
  @MaxLength(2000, { message: 'stallsDescription deve ter no máximo 2000 caracteres.' })
  stallsDescription?: string | null;

  // -----------------------
  // Endereço (schema atual Prisma)
  // -----------------------

  @ApiPropertyOptional({ example: '01001000', nullable: true, description: 'CEP com 8 dígitos.' })
  @IsOptional()
  @IsString({ message: 'zipCode deve ser string.' })
  @Matches(/^\d{8}$/, { message: 'zipCode deve conter 8 dígitos.' })
  zipCode?: string | null;

  @ApiPropertyOptional({
    example: 'Rua João Antônio de Moraes - Jardim Sampaio',
    nullable: true,
    description: 'Endereço “compacto” (rua + bairro etc.) conforme schema atual.',
  })
  @IsOptional()
  @IsString({ message: 'addressFull deve ser string.' })
  @Length(2, 240, { message: 'addressFull deve ter entre 2 e 240 caracteres.' })
  addressFull?: string | null;

  @ApiPropertyOptional({ example: '100', nullable: true })
  @IsOptional()
  @IsString({ message: 'addressNumber deve ser string.' })
  @Length(1, 30, { message: 'addressNumber deve ter entre 1 e 30 caracteres.' })
  addressNumber?: string | null;

  @ApiPropertyOptional({ example: 'São Paulo', nullable: true })
  @IsOptional()
  @IsString({ message: 'city deve ser string.' })
  @Length(2, 120, { message: 'city deve ter entre 2 e 120 caracteres.' })
  city?: string | null;

  @ApiPropertyOptional({ example: 'SP', nullable: true, description: 'UF com 2 letras.' })
  @IsOptional()
  @IsString({ message: 'state deve ser string.' })
  @Matches(/^[A-Za-z]{2}$/, { message: 'state deve ter 2 letras (UF).' })
  state?: string | null;

  // -----------------------
  // Financeiro (schema atual Prisma)
  // -----------------------

  @ApiPropertyOptional({
    example: '11999999999',
    nullable: true,
    description: 'Chave Pix (CPF/CNPJ, e-mail, telefone ou aleatória).',
  })
  @IsOptional()
  @IsString({ message: 'pixKey deve ser string.' })
  @Length(2, 200, { message: 'pixKey deve ter entre 2 e 200 caracteres.' })
  pixKey?: string | null;

  @ApiPropertyOptional({ enum: BankAccountType, nullable: true, example: BankAccountType.CORRENTE })
  @IsOptional()
  @IsEnum(BankAccountType, { message: 'bankAccountType inválido.' })
  bankAccountType?: BankAccountType | null;

  @ApiPropertyOptional({ example: '260 - Nu Pagamentos (Nubank)', nullable: true })
  @IsOptional()
  @IsString({ message: 'bankName deve ser string.' })
  @Length(2, 120, { message: 'bankName deve ter entre 2 e 120 caracteres.' })
  bankName?: string | null;

  @ApiPropertyOptional({ example: '1234', nullable: true, description: 'Somente dígitos.' })
  @IsOptional()
  @IsString({ message: 'bankAgency deve ser string.' })
  @Matches(/^\d{3,8}$/, { message: 'bankAgency deve conter de 3 a 8 dígitos.' })
  bankAgency?: string | null;

  @ApiPropertyOptional({ example: '98765', nullable: true, description: 'Somente dígitos.' })
  @IsOptional()
  @IsString({ message: 'bankAccount deve ser string.' })
  @Matches(/^\d{4,20}$/, { message: 'bankAccount deve conter de 4 a 20 dígitos.' })
  bankAccount?: string | null;

  @ApiPropertyOptional({ example: 'JOAO DA SILVA', nullable: true })
  @IsOptional()
  @IsString({ message: 'bankHolderName deve ser string.' })
  @Length(2, 200, { message: 'bankHolderName deve ter entre 2 e 200 caracteres.' })
  bankHolderName?: string | null;

  @ApiPropertyOptional({
    example: '12345678901',
    nullable: true,
    description: 'CPF/CNPJ do titular (somente dígitos).',
  })
  @IsOptional()
  @IsString({ message: 'bankHolderDocument deve ser string.' })
  @Matches(/^\d{11,14}$/, { message: 'bankHolderDocument deve conter 11 (CPF) ou 14 (CNPJ) dígitos.' })
  bankHolderDocument?: string | null;
}
