// src/modules/interests/dto/grant-portal-access.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { PasswordTokenType } from '@prisma/client';

/**
 * DTO para ação administrativa de "liberar acesso" ao portal do expositor.
 *
 * Responsabilidade:
 * - Permitir escolher tempo de expiração do link (30-60 min).
 * - Permitir escolher tipo do token (ativação vs reset).
 *
 * Decisão:
 * - `expiresInMinutes` é restrito a 30/60 para simplificar UX e reduzir erro humano.
 * - `type` usa o enum existente `PasswordTokenType`.
 */
export class GrantPortalAccessDto {
  @ApiPropertyOptional({
    description: 'Tempo de validade do link em minutos (30 ou 60).',
    enum: [30, 60],
    default: 60,
    example: 60,
  })
  @IsOptional()
  @IsInt()
  @IsIn([30, 60])
  expiresInMinutes?: 30 | 60;

  @ApiPropertyOptional({
    description: 'Tipo do token: ativação de conta ou reset de senha.',
    enum: PasswordTokenType,
    default: PasswordTokenType.ACTIVATE_ACCOUNT,
  })
  @IsOptional()
  @IsIn([PasswordTokenType.ACTIVATE_ACCOUNT, PasswordTokenType.RESET_PASSWORD])
  type?: PasswordTokenType;
}
