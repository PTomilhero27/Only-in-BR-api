/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MapTemplatesService } from './map-templates.service';
import { CreateMapTemplateDto } from './dto/create-map-template.dto';
import { UpdateMapTemplateDto } from './dto/update-map-template.dto';
import { MapTemplateResponseDto } from './dto/map-template-response.dto';

/**
 * MapTemplatesController
 *
 * Responsável por expor endpoints administrativos para gerenciar Plantas.
 * Planta = desenho reutilizável (template) que pode ser aplicado em várias feiras.
 */
@ApiTags('Map Templates')
@ApiBearerAuth()
@Controller('map-templates')
export class MapTemplatesController {
  constructor(private readonly service: MapTemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar uma planta (template) de mapa' })
  @ApiResponse({ status: 201, type: MapTemplateResponseDto })
  async create(@Body() dto: CreateMapTemplateDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar plantas (templates)' })
  @ApiResponse({ status: 200, type: [MapTemplateResponseDto] })
  async list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de uma planta' })
  @ApiResponse({ status: 200, type: MapTemplateResponseDto })
  async getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Put(':id')
  @ApiOperation({
    summary:
      'Atualizar planta (substitui elementos quando enviados e incrementa version)',
  })
  @ApiResponse({ status: 200, type: MapTemplateResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateMapTemplateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir planta' })
  @ApiResponse({ status: 200, description: 'OK' })
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
