import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/common/types/jwt-payload.type';
import { CreatePixRemittanceDto } from './dto/create-pix-remittance.dto';
import { MarkPixRemittancePaidDto } from './dto/mark-pix-remittance-paid.dto';
import { PayableItemResponseDto } from './dto/payable-item-response.dto';
import { PixRemittanceResponseDto } from './dto/pix-remittance-response.dto';
import { PixRemittancesService } from './pix-remittances.service';

/**
 * Este controller expõe endpoints administrativos para geração e gestão de remessas PIX
 * vinculadas à feira. Todos os endpoints exigem autenticação via JWT Bearer.
 */
@ApiTags('PixRemittances')
@ApiBearerAuth()
@Controller('fairs/:fairId/pix-remittances')
export class PixRemittancesController {
  constructor(private readonly service: PixRemittancesService) {}

  // ─── GET /payable-items ────────────────────────────────────────────────────

  @Get('payable-items')
  @ApiOperation({
    summary: 'Listar parcelas de fornecedores disponíveis para remessa PIX.',
    description:
      'Retorna todos os fornecedores/parcelas da feira com flag canBeSelected e motivo de desabilitação quando aplicável.',
  })
  @ApiParam({ name: 'fairId', description: 'ID da feira' })
  @ApiOkResponse({ type: [PayableItemResponseDto] })
  listPayableItems(
    @Param('fairId') fairId: string,
  ): Promise<PayableItemResponseDto[]> {
    return this.service.listPayableItems(fairId);
  }

  // ─── GET / ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar remessas PIX da feira.' })
  @ApiParam({ name: 'fairId', description: 'ID da feira' })
  @ApiOkResponse({ type: [PixRemittanceResponseDto] })
  list(@Param('fairId') fairId: string) {
    return this.service.list(fairId);
  }

  // ─── GET /:remittanceId ────────────────────────────────────────────────────

  @Get(':remittanceId')
  @ApiOperation({ summary: 'Detalhar uma remessa PIX.' })
  @ApiParam({ name: 'fairId', description: 'ID da feira' })
  @ApiParam({ name: 'remittanceId', description: 'ID da remessa' })
  @ApiOkResponse({ type: PixRemittanceResponseDto })
  findOne(
    @Param('fairId') fairId: string,
    @Param('remittanceId') remittanceId: string,
  ) {
    return this.service.findOne(fairId, remittanceId);
  }

  // ─── POST / ────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Gerar remessa(s) PIX de fornecedores.',
    description:
      'Cria 1 remessa (SINGLE) ou 2 remessas separadas (SPLIT_TWO) com base nos itens selecionados.',
  })
  @ApiParam({ name: 'fairId', description: 'ID da feira' })
  @ApiCreatedResponse({
    description: 'Remessa(s) gerada(s) com sucesso.',
    schema: {
      example: {
        createdRemittances: [
          {
            id: 'cuid',
            fileName: 'remessa-pix-feira-abc12345-20260510.txt',
            groupNumber: null,
            totalItems: 5,
            totalAmountCents: 820000,
          },
        ],
      },
    },
  })
  create(
    @Param('fairId') fairId: string,
    @Body() dto: CreatePixRemittanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(fairId, dto, user.id);
  }

  // ─── POST /:remittanceId/redo ───────────────────────────────────────────────

  @Post(':remittanceId/redo')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Refazer uma remessa PIX gerada.',
    description:
      'Cancela a remessa GENERATED informada, libera as parcelas e cria uma nova remessa com os itens enviados.',
  })
  @ApiParam({ name: 'fairId', description: 'ID da feira' })
  @ApiParam({
    name: 'remittanceId',
    description: 'ID da remessa que sera cancelada/refeita',
  })
  @ApiCreatedResponse({
    description:
      'Remessa anterior cancelada e nova remessa gerada com sucesso.',
  })
  redo(
    @Param('fairId') fairId: string,
    @Param('remittanceId') remittanceId: string,
    @Body() dto: CreatePixRemittanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.redo(fairId, remittanceId, dto, user.id);
  }

  // ─── GET /:remittanceId/download ───────────────────────────────────────────

  @Get(':remittanceId/download')
  @ApiOperation({
    summary: 'Download do arquivo TXT/CNAB de uma remessa.',
    description:
      'Retorna o conteúdo do arquivo como text/plain com header Content-Disposition para download.',
  })
  @ApiParam({ name: 'fairId', description: 'ID da feira' })
  @ApiParam({ name: 'remittanceId', description: 'ID da remessa' })
  async download(
    @Param('fairId') fairId: string,
    @Param('remittanceId') remittanceId: string,
    @Res() res: Response,
  ) {
    const { fileName, fileContent } = await this.service.getDownloadFile(
      fairId,
      remittanceId,
    );

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(fileContent);
  }

  // ─── PATCH /:remittanceId/mark-paid ───────────────────────────────────────

  @Patch(':remittanceId/mark-paid')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Marcar remessa PIX como paga.',
    description:
      'Atualiza o status da remessa para PAID, marca as parcelas incluídas como pagas e recalcula o status dos fornecedores.',
  })
  @ApiParam({ name: 'fairId', description: 'ID da feira' })
  @ApiParam({ name: 'remittanceId', description: 'ID da remessa' })
  @ApiOkResponse({ type: PixRemittanceResponseDto })
  markPaid(
    @Param('fairId') fairId: string,
    @Param('remittanceId') remittanceId: string,
    @Body() dto: MarkPixRemittancePaidDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.markPaid(fairId, remittanceId, dto, user.id);
  }

  // ─── PATCH /:remittanceId/cancel ──────────────────────────────────────────

  @Patch(':remittanceId/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancelar remessa PIX gerada.',
    description:
      'Cancela a remessa e reverte as parcelas incluídas de volta para PENDING. Não exclui registros históricos.',
  })
  @ApiParam({ name: 'fairId', description: 'ID da feira' })
  @ApiParam({ name: 'remittanceId', description: 'ID da remessa' })
  @ApiOkResponse({ type: PixRemittanceResponseDto })
  cancel(
    @Param('fairId') fairId: string,
    @Param('remittanceId') remittanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.cancel(fairId, remittanceId, user.id);
  }
}
