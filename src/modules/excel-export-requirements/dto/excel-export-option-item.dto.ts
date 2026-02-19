import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ExcelExportOptionItemDto
 *
 * Representa um item "selecionável" em um autocomplete.
 * Ex.: uma Feira, um Expositor, uma Barraca.
 *
 * Decisão:
 * - Mantemos label pronto para UX.
 * - meta é opcional para exibir informações adicionais no front
 *   (ex.: status, documento, etc).
 */
export class ExcelExportOptionItemDto {
  @ApiProperty({
    example: 'd91e0425-29d5-4228-94f1-329e40065ddc',
    description: 'ID do item (UUID/CUID conforme o tipo).',
  })
  id!: string;

  @ApiProperty({
    example: 'Feira de Verão 2026',
    description: 'Texto amigável para exibir no autocomplete.',
  })
  label!: string;

  @ApiPropertyOptional({
    example: { status: 'ATIVA' },
    description: 'Metadados opcionais para UI (ex.: status, documento, etc).',
  })
  meta?: Record<string, unknown>;
}
