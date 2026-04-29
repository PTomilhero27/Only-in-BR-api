import {
  Body,
  Controller,
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
import { ListPayableItemsDto } from '../fair-payees/dto/list-payable-items.dto';
import { FairPayeesService } from '../fair-payees/fair-payees.service';
import { CreatePixRemittanceDto } from './dto/create-pix-remittance.dto';
import { PixRemittancesService } from './pix-remittances.service';

/**
 * Controller administrativo para remessas PIX da feira.
 * Expoe endpoints para gerar arquivos, listar remessas, marcar pagamento e cancelar.
 */
@ApiTags('PixRemittances')
@ApiBearerAuth()
@Controller('fairs/:fairId/pix-remittances')
export class PixRemittancesController {
  constructor(
    private readonly service: PixRemittancesService,
    private readonly fairPayees: FairPayeesService,
  ) {}

  @Get('payable-items')
  @ApiOperation({
    summary: 'Listar itens disponiveis para entrar em remessa PIX.',
  })
  @ApiOkResponse({
    description: 'Itens pagaveis de fornecedores e/ou expositores.',
  })
  listPayableItems(
    @Param('fairId') fairId: string,
    @Query() query: ListPayableItemsDto,
  ) {
    return this.fairPayees.listPayableItems(fairId, query);
  }

  @Get()
  @ApiOperation({ summary: 'Listar remessas PIX da feira.' })
  list(@Param('fairId') fairId: string) {
    return this.service.list(fairId);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Gerar remessa PIX com itens mistos.' })
  @ApiCreatedResponse({ description: 'Remessa gerada.' })
  create(
    @Param('fairId') fairId: string,
    @Body() dto: CreatePixRemittanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(fairId, dto, user.id);
  }

  @Patch(':remittanceId/paid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar remessa PIX como paga.' })
  markPaid(
    @Param('fairId') fairId: string,
    @Param('remittanceId') remittanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.markPaid(fairId, remittanceId, user.id);
  }

  @Patch(':remittanceId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancelar remessa PIX gerada.' })
  cancel(
    @Param('fairId') fairId: string,
    @Param('remittanceId') remittanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.cancel(fairId, remittanceId, user.id);
  }
}
