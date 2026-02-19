import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de resumo de FairForm na listagem de feiras.
 * Responsabilidade:
 * - Expor ao admin o mínimo para saber:
 *   - quais forms estão vinculados à feira
 *   - se estão habilitados na feira (enabled)
 *   - qual janela (startsAt/endsAt)
 *   - se o form global está ativo (Form.active)
 *
 * Por que existe:
 * - O admin precisa gerar o link do form (ex.: stalls) e conferir janela/ativação
 *   diretamente na tela de feiras, sem depender de navegar em outras telas.
 */
export class FairFormSummaryDto {
  @ApiProperty({
    example: 'stalls',
    description:
      'Identificador lógico do formulário (slug). Usado também na URL do form externo.',
  })
  slug: string;

  @ApiProperty({
    example: 'Cadastro de barracas',
    description: 'Nome do formulário exibido no painel (catálogo global).',
  })
  name: string;

  @ApiProperty({
    example: true,
    description: 'Se o formulário está ativo globalmente (Form.active).',
  })
  active: boolean;

  @ApiProperty({
    example: true,
    description:
      'Se o formulário está habilitado para esta feira (FairForm.enabled).',
  })
  enabled: boolean;

  @ApiProperty({
    example: '2026-01-21T20:21:00.000Z',
    description:
      'Início da janela de liberação do formulário nesta feira (ISO).',
  })
  startsAt: string;

  @ApiProperty({
    example: '2026-01-28T20:21:00.000Z',
    description: 'Fim da janela de liberação do formulário nesta feira (ISO).',
  })
  endsAt: string;
}
