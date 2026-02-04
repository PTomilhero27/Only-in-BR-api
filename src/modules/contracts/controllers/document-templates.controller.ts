import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListDocumentTemplatesDto } from '../dto/templates/list-document-templates.dto';
import { DocumentTemplatesService } from '../services/document-templates.service';
import { CreateDocumentTemplateDto } from '../dto/templates/create-document-template.dto';
import { UpdateDocumentTemplateDto } from '../dto/templates/update-document-template.dto';
import { UpsertFairContractSettingsDto } from '../dto/templates/upsert-fair-contract-settings.dto';
import { type JwtPayload } from 'src/common/types/jwt-payload.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('DocumentTemplates')
@ApiBearerAuth()
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly service: DocumentTemplatesService) { }

  @Post()
  @ApiOperation({
    summary: 'Criar template de documento',
    description:
      'Cria um template global (contrato ou aditivo) com metadados e o conteúdo JSON do editor. ' +
      'Esse "content" é o que o front usa para renderizar o contrato dinamicamente.',
  })
  @ApiBody({
    type: CreateDocumentTemplateDto,
    examples: {
      contratoPrincipal: {
        summary: 'Contrato principal (DRAFT)',
        value: {
          title: 'Contrato de Exposição de Produtos',
          isAddendum: false,
          hasRegistration: true,
          status: 'DRAFT',
          content: {
            blocks: [
              { type: 'heading', text: 'CONTRATO DE EXPOSIÇÃO DE PRODUTOS' },
              { type: 'paragraph', text: 'Pelo presente instrumento...' },
            ],
          },
        },
      },
      aditivo: {
        summary: 'Aditivo por expositor',
        value: {
          title: 'Aditivo de Energia Extra',
          isAddendum: true,
          hasRegistration: false,
          status: 'DRAFT',
          content: {
            blocks: [{ type: 'paragraph', text: 'Cláusula adicional...' }],
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Template criado com sucesso.' })
  create(@Body() dto: CreateDocumentTemplateDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar templates',
    description:
      'Lista templates globais. Você pode filtrar por status e por isAddendum. ' +
      'Por padrão retorna o template completo (incluindo content).',
  })
  @ApiResponse({ status: 200, description: 'Lista retornada com sucesso.' })
  list(@Query() query: ListDocumentTemplatesDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar template por ID',
    description:
      'Retorna um template específico (incluindo o conteúdo JSON do editor). Use isso para abrir a tela de edição.',
  })
  @ApiParam({ name: 'id', description: 'ID do template (UUID).', example: 'fcb5913a-f5f1-4353-967f-0d7e049d17e3' })
  @ApiResponse({ status: 200, description: 'Template encontrado.' })
  @ApiResponse({ status: 404, description: 'Template não encontrado.' })
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar template',
    description:
      'Atualiza metadados e/ou o conteúdo (JSON do editor). ' +
      'Use isso para publicar (status=PUBLISHED) ou arquivar (status=ARCHIVED), além de editar title/flags/content.',
  })
  @ApiParam({ name: 'id', description: 'ID do template (UUID).', example: 'fcb5913a-f5f1-4353-967f-0d7e049d17e3' })
  @ApiBody({
    type: UpdateDocumentTemplateDto,
    examples: {
      publicar: {
        summary: 'Publicar template',
        value: { status: 'PUBLISHED' },
      },
      editarTudo: {
        summary: 'Editar metadados + conteúdo',
        value: {
          title: 'Contrato de Exposição (v2)',
          hasRegistration: true,
          status: 'DRAFT',
          content: {
            blocks: [
              { type: 'heading', text: 'CONTRATO (VERSÃO 2)' },
              { type: 'paragraph', text: 'Cláusula 1 - ...' },
            ],
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Template atualizado com sucesso.' })
  @ApiResponse({ status: 404, description: 'Template não encontrado.' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentTemplateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Excluir template',
    description:
      'Exclui um template. Recomendação: se você quiser preservar histórico, use status=ARCHIVED em vez de deletar.',
  })
  @ApiParam({ name: 'id', description: 'ID do template (UUID).', example: 'fcb5913a-f5f1-4353-967f-0d7e049d17e3' })
  @ApiResponse({ status: 200, description: 'Template excluído com sucesso.' })
  @ApiResponse({ status: 404, description: 'Template não encontrado.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

