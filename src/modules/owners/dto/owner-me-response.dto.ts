/**
 * DTO de resposta do perfil do expositor (Owner).
 *
 * Objetivo:
 * - Ser o contrato único consumido pelo portal em GET /owners/me
 * - Retornar campos editáveis e campos somente leitura (document/email/personType)
 *
 * Decisão:
 * - Os nomes do contrato do portal são “amigáveis” (name, zipCode, etc.),
 *   e o service faz o mapeamento para o schema real do Prisma (fullName, addressZipcode...).
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BankAccountType, PersonType } from '@prisma/client';

export class OwnerMeResponseDto {
  @ApiProperty({ example: 'cku2m9b2f0001u8x9a1b2c3d4' })
  id: string;

  // -----------------------
  // Somente leitura
  // -----------------------

  @ApiProperty({
    enum: PersonType,
    example: PersonType.PF,
    description: 'Tipo de pessoa. Somente leitura no portal.',
  })
  personType: PersonType;

  @ApiProperty({
    example: '12345678901',
    description: 'CPF/CNPJ (somente dígitos). Somente leitura no portal.',
  })
  document: string;

  @ApiPropertyOptional({
    example: 'joao@email.com',
    nullable: true,
    description: 'E-mail do expositor. Somente leitura no portal.',
  })
  email: string | null;

  // -----------------------
  // Dados pessoais (editáveis)
  // -----------------------

  @ApiPropertyOptional({
    example: 'João da Silva',
    nullable: true,
    description: 'Nome (PF) ou Razão Social (PJ).',
  })
  name: string | null;

  @ApiPropertyOptional({ example: '11999999999', nullable: true, description: 'Somente dígitos.' })
  phone: string | null;

  @ApiPropertyOptional({
    example: 'Barraca de batata + pastel; também vendo caldo de cana.',
    nullable: true,
    description: 'Descrição livre das barracas/produtos para triagem e operação.',
  })
  stallsDescription: string | null;

  // -----------------------
  // Endereço (editáveis)
  // -----------------------

  @ApiPropertyOptional({ example: '01001000', nullable: true, description: 'CEP com 8 dígitos.' })
  zipCode: string | null;

  @ApiPropertyOptional({
    example: 'Rua João Antônio de Moraes - Jardim Sampaio',
    nullable: true,
    description: 'Endereço “compacto” (rua + bairro etc.) conforme schema atual.',
  })
  addressFull: string | null;

  @ApiPropertyOptional({ example: '100', nullable: true, description: 'Número do endereço.' })
  addressNumber: string | null;

  @ApiPropertyOptional({ example: 'São Paulo', nullable: true })
  city: string | null;

  @ApiPropertyOptional({ example: 'SP', nullable: true, description: 'UF com 2 letras.' })
  state: string | null;

  // -----------------------
  // Financeiro (editáveis)
  // -----------------------

  @ApiPropertyOptional({
    example: '11999999999',
    nullable: true,
    description: 'Chave Pix (pode ser CPF/CNPJ, e-mail, telefone ou aleatória).',
  })
  pixKey: string | null;

  @ApiPropertyOptional({ enum: BankAccountType, nullable: true, example: BankAccountType.CORRENTE })
  bankAccountType: BankAccountType | null;

  @ApiPropertyOptional({ example: '260 - Nu Pagamentos (Nubank)', nullable: true })
  bankName: string | null;

  @ApiPropertyOptional({ example: '1234', nullable: true, description: 'Somente dígitos.' })
  bankAgency: string | null;

  @ApiPropertyOptional({ example: '987654', nullable: true, description: 'Somente dígitos.' })
  bankAccount: string | null;

  @ApiPropertyOptional({ example: 'JOAO DA SILVA', nullable: true })
  bankHolderName: string | null;

  @ApiPropertyOptional({
    example: '12345678901',
    nullable: true,
    description: 'CPF/CNPJ do titular (somente dígitos).',
  })
  bankHolderDocument: string | null;
}
