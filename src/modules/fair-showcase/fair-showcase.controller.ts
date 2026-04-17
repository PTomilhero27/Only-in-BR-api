import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { FairShowcaseService } from './fair-showcase.service';
import { CreateFairShowcaseDto } from './dto/create-fair-showcase.dto';
import { UpdateFairShowcaseDto } from './dto/update-fair-showcase.dto';

/**
 * Controller admin para Vitrine de Feiras (FairShowcase).
 *
 * Rotas (JWT obrigatório):
 * - GET    /fair-showcase            → listar todas as vitrines
 * - GET    /fair-showcase/:fairId    → buscar vitrine de uma feira
 * - POST   /fair-showcase/:fairId    → criar vitrine
 * - PATCH  /fair-showcase/:fairId    → atualizar vitrine
 * - DELETE /fair-showcase/:fairId    → remover vitrine
 * - PATCH  /fair-showcase/:fairId/publish   → publicar
 * - PATCH  /fair-showcase/:fairId/unpublish → despublicar
 * - POST   /fair-showcase/:fairId/upload    → upload de imagem
 */
@ApiTags('Fair Showcase (Admin)')
@ApiBearerAuth()
@Controller('fair-showcase')
export class FairShowcaseController {
  constructor(private readonly service: FairShowcaseService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as vitrines de feiras' })
  list() {
    return this.service.list();
  }

  @Get(':fairId')
  @ApiOperation({ summary: 'Buscar vitrine de uma feira' })
  getByFairId(@Param('fairId') fairId: string) {
    return this.service.getByFairId(fairId);
  }

  @Post(':fairId')
  @ApiOperation({
    summary: 'Criar vitrine para uma feira',
    description:
      'Todos os campos são opcionais para criação incremental. ' +
      'O admin cria e vai preenchendo aos poucos.',
  })
  create(
    @Param('fairId') fairId: string,
    @Body() dto: CreateFairShowcaseDto,
  ) {
    return this.service.create(fairId, dto);
  }

  @Patch(':fairId')
  @ApiOperation({ summary: 'Atualizar vitrine (PATCH parcial)' })
  update(
    @Param('fairId') fairId: string,
    @Body() dto: UpdateFairShowcaseDto,
  ) {
    return this.service.update(fairId, dto);
  }

  @Delete(':fairId')
  @ApiOperation({ summary: 'Remover vitrine' })
  remove(@Param('fairId') fairId: string) {
    return this.service.remove(fairId);
  }

  @Patch(':fairId/publish')
  @ApiOperation({ summary: 'Publicar vitrine (torna visível no portal)' })
  publish(@Param('fairId') fairId: string) {
    return this.service.togglePublish(fairId, true);
  }

  @Patch(':fairId/unpublish')
  @ApiOperation({ summary: 'Despublicar vitrine (oculta do portal)' })
  unpublish(@Param('fairId') fairId: string) {
    return this.service.togglePublish(fairId, false);
  }

  @Post(':fairId/upload')
  @ApiOperation({
    summary: 'Upload de imagem para a vitrine',
    description:
      'Faz upload de imagem no Supabase Storage e retorna a URL pública. ' +
      'O admin usa a URL para salvar em coverImageUrl ou galleryImageUrls via PATCH. ' +
      'Formatos aceitos: JPEG, PNG, WebP, GIF. Máximo 5MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @Param('fairId') fairId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadImage(fairId, file);
  }
}
