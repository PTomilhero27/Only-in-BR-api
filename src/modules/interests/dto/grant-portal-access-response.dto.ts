// src/modules/interests/dto/grant-portal-access-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { PasswordTokenType } from '@prisma/client';

/**
 * DTO de resposta para geração de link temporário do portal.
 *
 * Importante:
 * - `activationLink` contém o token "puro" (raw token), usado apenas uma vez.
 * - O banco armazena somente o hash do token.
 */
export class GrantPortalAccessResponseDto {
  @ApiProperty({ example: 'ckx123...' })
  ownerId: string;

  @ApiProperty({ example: 'c0a8012a-...' })
  userId: string;

  @ApiProperty({ enum: PasswordTokenType, example: PasswordTokenType.ACTIVATE_ACCOUNT })
  tokenType: PasswordTokenType;

  @ApiProperty({ example: '2026-01-28T23:30:00.000Z' })
  expiresAt: string;

  @ApiProperty({
    example: 'https://portal.expositor.com/ativar?token=RAW_TOKEN_AQUI',
  })
  activationLink: string;
}
