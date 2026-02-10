// src/modules/interest-fairs/interest-fairs.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { InterestFairsService } from './interest-fairs.service'
import { LinkInterestToFairDto } from './dto/link-interest-to-fair.dto'
import { CurrentUser } from 'src/common/decorators/current-user.decorator'
import type { JwtPayload } from 'src/common/types/jwt-payload.type'
import { PatchOwnerFairPurchasesDto } from './dto/patch-owner-fair-purchases.dto'

@ApiTags('InterestFairs')
@Controller('interests/:id/fairs')
export class InterestFairsController {
  constructor(private readonly service: InterestFairsService) { }

  @Get()
  @ApiOperation({
    summary: 'Listar feiras vinculadas ao interessado',
    description:
      'Retorna os vínculos Owner↔Fair com as compras (linhas 1 por 1) configuradas pelo admin.',
  })
  @ApiParam({ name: 'id', description: 'ID do interessado (Owner)' })
  @ApiResponse({ status: 200, description: 'Lista de vínculos Owner↔Fair.' })
  list(@Param('id') ownerId: string) {
    return this.service.listByOwner(ownerId)
  }

  @Post()
  @ApiOperation({
    summary: 'Vincular interessado a uma feira (com compras 1 por 1)',
    description:
      'Cria o vínculo Owner↔Fair e registra as compras em linhas separadas (tamanho/valor/pago/parcelas).',
  })
  @ApiParam({ name: 'id', description: 'ID do interessado (Owner)' })
  @ApiResponse({ status: 201, description: 'Vínculo criado com sucesso.' })
  @ApiResponse({ status: 409, description: 'O interessado já está vinculado a esta feira.' })
  link(
    @Param('id') ownerId: string,
    @Body() dto: LinkInterestToFairDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.link(ownerId, dto, user)
  }

  @Delete(':fairId')
  @ApiOperation({
    summary: 'Remover vínculo entre interessado e feira',
    description:
      'Remove OwnerFair e tudo que depende dele. Se houver StallFair vinculado, o service bloqueia.',
  })
  @ApiParam({ name: 'id', description: 'ID do interessado (Owner)' })
  @ApiParam({ name: 'fairId', description: 'ID da feira vinculada' })
  remove(
    @Param('id') ownerId: string,
    @Param('fairId') fairId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(ownerId, fairId, user)
  }

  @Patch(':fairId/purchases')
  @ApiOperation({
    summary: 'Editar compras do vínculo (replace total)',
    description:
      'Substitui todas as compras (OwnerFairPurchase + parcelas) do vínculo Owner↔Fair. ' +
      'Por segurança, bloqueia edição se já houver consumo (barracas vinculadas / usedQty > 0).',
  })
  @ApiParam({ name: 'id', description: 'ID do interessado (Owner)' })
  @ApiParam({ name: 'fairId', description: 'ID da feira vinculada' })
  @ApiResponse({ status: 200, description: 'Compras substituídas com sucesso.' })
  @ApiResponse({ status: 400, description: 'Payload inválido / regras de negócio.' })
  @ApiResponse({ status: 409, description: 'Edição bloqueada porque já houve consumo (usedQty > 0).' })
  patchPurchases(
    @Param('id') ownerId: string,
    @Param('fairId') fairId: string,
    @Body() dto: PatchOwnerFairPurchasesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.patchPurchasesReplaceTotal(ownerId, fairId, dto, user)
  }
}
