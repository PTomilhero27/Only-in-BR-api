// src/modules/interests/dto/list-interests-item.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonType, BankAccountType } from '@prisma/client';

/**
 * DTO de item para listagem de interessados no painel.
 *
 * Responsabilidade:
 * - Definir shape estável consumido pelo front (Zod).
 *
 * Decisão:
 * - Inclui campos calculados (`hasPortalLogin`, `stallsCount`) para evitar inferência no front.
 */
export class ListInterestsItemDto {
  @ApiProperty({ example: 'ckx123...' })
  id: string;

  @ApiProperty({ enum: PersonType, example: PersonType.PF })
  personType: PersonType;

  @ApiProperty({
    description: 'Documento normalizado (somente dígitos).',
    example: '06877511107',
  })
  document: string;

  @ApiPropertyOptional({ nullable: true, example: 'Heloisa Lima Vale' })
  fullName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'helo14vale@gmail.com' })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '11999998888' })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01001000' })
  addressZipcode?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Rua X, 123 - Centro' })
  addressFull?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'São Paulo' })
  addressCity?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'SP' })
  addressState?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'chave-pix@exemplo.com' })
  pixKey?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Banco do Brasil' })
  bankName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1234' })
  bankAgency?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '98765-4' })
  bankAccount?: string | null;

  @ApiPropertyOptional({ nullable: true, enum: BankAccountType, example: BankAccountType.CORRENTE })
  bankAccountType?: BankAccountType | null;

  @ApiPropertyOptional({ nullable: true, example: '12345678901' })
  bankHolderDoc?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Fulano de Tal' })
  bankHolderName?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Descrição da operação (triagem).',
    example: 'Trabalho com comida árabe e tenho trailer.',
  })
  stallsDescription?: string | null;

  /**
   * ✅ NOVO
   * true quando existe usuário do portal vinculado ao Owner com senha definida.
   */
  @ApiProperty({
    description: 'Indica se o interessado já possui login/senha definidos no portal.',
    example: false,
  })
  hasPortalLogin: boolean;

  /**
   * ✅ NOVO
   * Contagem de barracas cadastradas pelo Owner.
   */
  @ApiProperty({
    description: 'Quantidade de barracas cadastradas pelo expositor.',
    example: 2,
  })
  stallsCount: number;

  @ApiProperty({ example: '2026-01-28T21:49:18.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-01-28T21:49:18.000Z' })
  updatedAt: string;
}
