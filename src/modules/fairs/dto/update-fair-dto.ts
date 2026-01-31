import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, IsNotEmpty, Min, IsInt } from 'class-validator'
import { FairStatus } from '@prisma/client'

/**
 * DTO para atualização de uma feira (PATCH).
 *
 * Responsabilidade:
 * - Permitir edição parcial das informações básicas da feira.
 *
 * Decisões importantes:
 * - Este DTO NÃO permite editar ocorrências.
 *   As datas/horários serão tratadas em endpoints próprios no futuro.
 * - Todos os campos são opcionais, mas ao menos um deve ser enviado
 *   (essa validação acontece no service).
 */
export class UpdateFairDto {
  @ApiPropertyOptional({
    example: 'Feira Gastronômica de Inverno',
    description: 'Novo nome da feira.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string

  @ApiPropertyOptional({
    example: 'Rua das Palmeiras, 500 - Centro',
    description: 'Novo endereço da feira.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string

  @ApiPropertyOptional({
    enum: FairStatus,
    example: FairStatus.FINALIZADA,
    description: 'Novo status da feira.',
  })
  @IsOptional()
  @IsEnum(FairStatus)
  status?: FairStatus

  @ApiPropertyOptional({
    example: 150,
    description: 'Capacidade máxima de barracas da feira.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stallsCapacity?: number
}
