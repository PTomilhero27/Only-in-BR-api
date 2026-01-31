import { ApiProperty } from '@nestjs/swagger';

/**
 * PublicOwnerResponseDto
 *
 * Responsabilidade:
 * - Retornar uma resposta mínima para o front confirmar que salvou.
 *
 * Decisão:
 * - Para o cadastro inicial, não precisamos devolver o Owner inteiro.
 */
export class PublicOwnerResponseDto {
  @ApiProperty({ example: 'ckx123...' })
  ownerId: string;
}
