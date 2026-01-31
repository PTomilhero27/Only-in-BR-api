import { ApiProperty } from '@nestjs/swagger';
import { DocumentTemplateStatus } from '@prisma/client';

/**
 * DTO de resposta do template.
 *
 * Responsabilidade:
 * - Padronizar o formato retornado no Swagger/Front.
 */
export class DocumentTemplateResponseDto {
  @ApiProperty({ example: 'fcb5913a-f5f1-4353-967f-0d7e049d17e3', description: 'ID do template (UUID).' })
  id!: string;

  @ApiProperty({ example: 'Contrato de Exposição de Produtos', description: 'Título exibido no painel.' })
  title!: string;

  @ApiProperty({ example: false, description: 'Se é um aditivo (por pessoa/OwnerFair).' })
  isAddendum!: boolean;

  @ApiProperty({ example: true, description: 'Se inclui ficha cadastral (ANEXO I).' })
  hasRegistration!: boolean;

  @ApiProperty({ enum: DocumentTemplateStatus, example: 'DRAFT', description: 'Status editorial do template.' })
  status!: DocumentTemplateStatus;

  @ApiProperty({
    description: 'Conteúdo do template (JSON do editor).',
    example: { blocks: [{ type: 'heading', text: 'CONTRATO...' }] },
  })
  content!: Record<string, any>;

  @ApiProperty({ example: '2026-01-27T12:00:00.000Z', description: 'Data de criação.' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-27T12:10:00.000Z', description: 'Última atualização.' })
  updatedAt!: Date;
}
