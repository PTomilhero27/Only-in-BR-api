import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentTemplateStatus } from '@prisma/client';

/**
 * DTO de criação de template de documento (contrato/aditivo).
 *
 * Responsabilidade:
 * - Criar um template global com metadados + conteúdo (JSON do editor).
 *
 * Observações importantes:
 * - "content" é obrigatório e representa o corpo do contrato (dinâmico).
 * - "isAddendum" define se o template é um aditivo.
 * - "hasRegistration" controla se o contrato inclui a ficha cadastral (ANEXO I).
 *
 * Exemplo de uso:
 * POST /document-templates
 * {
 *   "title": "Contrato de Exposição de Produtos",
 *   "isAddendum": false,
 *   "hasRegistration": true,
 *   "status": "DRAFT",
 *   "content": { "blocks": [ { "type": "heading", "text": "Cláusula 1..." } ] }
 * }
 */
export class CreateDocumentTemplateDto {
  @ApiProperty({
    description: 'Nome exibido no painel admin.',
    example: 'Contrato de Exposição de Produtos',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    description:
      'Indica se este template é um aditivo. Regra: aditivos só são aplicados por pessoa (OwnerFair), nunca por feira.',
    example: false,
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isAddendum?: boolean;

  @ApiProperty({
    description:
      'Indica se o contrato inclui a ficha cadastral (ANEXO I). Usado no front para renderizar a seção extra.',
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  hasRegistration?: boolean;

  @ApiProperty({
    description:
      'Status editorial do template. Use DRAFT enquanto edita, PUBLISHED para disponibilizar e ARCHIVED para não usar em novos vínculos.',
    example: 'DRAFT',
    enum: DocumentTemplateStatus,
    default: DocumentTemplateStatus.DRAFT,
    required: false,
  })
  @IsEnum(DocumentTemplateStatus)
  @IsOptional()
  status?: DocumentTemplateStatus;

  @ApiProperty({
    description:
      'Conteúdo principal do template (JSON do editor). É isso que o front usa para renderizar/editar o contrato dinamicamente.',
    example: {
      blocks: [
        { type: 'heading', text: 'CONTRATO DE EXPOSIÇÃO DE PRODUTOS' },
        { type: 'paragraph', text: 'Pelo presente instrumento...' },
      ],
    },
  })
  @IsObject()
  content!: Record<string, any>;
}
