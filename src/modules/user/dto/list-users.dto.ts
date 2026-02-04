import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * ListUsersDto
 * Parâmetros de listagem/filtragem de usuários (Admin).
 *
 * Regras:
 * - Vamos filtrar por padrão "não-expositor" no service (role != EXHIBITOR),
 *   mas deixamos query para buscar e paginação.
 */
export class ListUsersDto {
  @ApiPropertyOptional({
    example: 'maria',
    description: 'Busca textual (nome/email).',
  })
  @IsOptional()
  @IsString({ message: 'search deve ser texto.' })
  search?: string;

  @ApiPropertyOptional({
    example: 'true',
    description: 'Se informado, filtra por ativo/inativo (string "true"/"false").',
  })
  @IsOptional()
  @IsBooleanString({ message: 'isActive deve ser "true" ou "false".' })
  isActive?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Página (começa em 1).',
    default: 1,
  })
  @IsOptional()
  @IsInt({ message: 'page deve ser um número inteiro.' })
  @Min(1, { message: 'page deve ser >= 1.' })
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Itens por página (1..100).',
    default: 20,
  })
  @IsOptional()
  @IsInt({ message: 'pageSize deve ser um número inteiro.' })
  @Min(1, { message: 'pageSize deve ser >= 1.' })
  @Max(100, { message: 'pageSize deve ser <= 100.' })
  pageSize?: number = 20;
}
