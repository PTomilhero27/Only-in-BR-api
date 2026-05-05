import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/common/types/jwt-payload.type';
import { CreateExhibitorPayoutDto } from './dto/create-exhibitor-payout.dto';
import { UpdateExhibitorPayoutImportConfigDto } from './dto/exhibitor-payout-import-config.dto';
import { ExhibitorPayoutImportPreviewResponseDto } from './dto/exhibitor-payout-import-preview.dto';
import { ExhibitorPayoutResponseDto } from './dto/exhibitor-payout-response.dto';
import { ListExhibitorPayoutsDto } from './dto/list-exhibitor-payouts.dto';
import { UpdateExhibitorPayoutDto } from './dto/update-exhibitor-payout.dto';
import { ExhibitorPayoutsImportService } from './exhibitor-payouts-import.service';
import { ExhibitorPayoutsService } from './exhibitor-payouts.service';

/**
 * Controller administrativo para repasses de expositores da feira.
 * Expoe endpoints para o financeiro registrar ganhos, revisar valores e cancelar repasses.
 */
@ApiTags('ExhibitorPayouts')
@ApiBearerAuth()
@Controller('fairs/:fairId/exhibitor-payouts')
export class ExhibitorPayoutsController {
  constructor(
    private readonly service: ExhibitorPayoutsService,
    private readonly importService: ExhibitorPayoutsImportService,
  ) {}

  @Get('import-config')
  @ApiOperation({
    summary: 'Obter configuracao da importacao de repasses de expositores.',
  })
  getImportConfig(@Param('fairId') fairId: string) {
    return this.importService.getConfig(fairId);
  }

  @Patch('import-config')
  @ApiOperation({
    summary: 'Atualizar configuracao da importacao de repasses de expositores.',
  })
  updateImportConfig(
    @Param('fairId') fairId: string,
    @Body() dto: UpdateExhibitorPayoutImportConfigDto,
  ) {
    return this.importService.updateConfig(fairId, dto);
  }

  @Post('import/preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Gerar previa da importacao de repasses de expositores.',
  })
  @ApiOkResponse({ type: ExhibitorPayoutImportPreviewResponseDto })
  previewImport(@Param('fairId') fairId: string) {
    return this.importService.preview(fairId);
  }

  @Post('import/confirm')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirmar importacao de repasses de expositores.',
  })
  confirmImport(
    @Param('fairId') fairId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.importService.confirm(fairId, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar expositores da feira com seus repasses.' })
  @ApiOkResponse({ type: [ExhibitorPayoutResponseDto] })
  list(
    @Param('fairId') fairId: string,
    @Query() query: ListExhibitorPayoutsDto,
  ) {
    return this.service.list(fairId, query);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Criar ou registrar valor de repasse para expositor.',
  })
  @ApiCreatedResponse({ type: ExhibitorPayoutResponseDto })
  create(
    @Param('fairId') fairId: string,
    @Body() dto: CreateExhibitorPayoutDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(fairId, dto, user.id);
  }

  @Patch(':payoutId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Editar valores ou observacoes de um repasse.' })
  @ApiOkResponse({ type: ExhibitorPayoutResponseDto })
  update(
    @Param('fairId') fairId: string,
    @Param('payoutId') payoutId: string,
    @Body() dto: UpdateExhibitorPayoutDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(fairId, payoutId, dto, user.id);
  }

  @Delete(':payoutId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancelar ou remover um repasse de expositor.' })
  delete(
    @Param('fairId') fairId: string,
    @Param('payoutId') payoutId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.delete(fairId, payoutId, user.id);
  }
}
