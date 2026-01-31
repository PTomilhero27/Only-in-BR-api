import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InterestFairsService } from './interest-fairs.service';
import { LinkInterestToFairDto } from './dto/link-interest-to-fair.dto';
import { UpdateOwnerFairDto } from './dto/update-owner-fair.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtPayload } from 'src/common/types/jwt-payload.type';

@ApiTags('InterestFairs')
@Controller('interests/:id/fairs')
export class InterestFairsController {
  constructor(private readonly service: InterestFairsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar feiras vinculadas ao interessado',
    description:
      'Retorna as feiras vinculadas ao interessado, incluindo compra por tamanho e plano de pagamento.',
  })
  @ApiParam({ name: 'id', description: 'ID do interessado (Owner)' })
  @ApiResponse({ status: 200, description: 'Lista de vínculos Owner↔Fair.' })
  list(@Param('id') ownerId: string) {
    return this.service.listByOwner(ownerId);
  }

  @Post()
  @ApiOperation({
    summary: 'Vincular interessado a uma feira',
    description:
      'Cria o vínculo Owner↔Fair com compra por tamanho e plano de pagamento. Valida capacidade da feira.',
  })
  @ApiParam({ name: 'id', description: 'ID do interessado (Owner)' })
  @ApiResponse({ status: 201, description: 'Vínculo criado com sucesso.' })
  @ApiResponse({ status: 409, description: 'O interessado já está vinculado a esta feira.' })
  link(
    @Param('id') ownerId: string,
    @Body() dto: LinkInterestToFairDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.link(ownerId, dto, user);
  }

  @Patch(':fairId')
  @ApiOperation({
    summary: 'Atualizar vínculo entre interessado e feira',
    description:
      'Atualiza compra por tamanho e plano de pagamento. Revalida capacidade da feira.',
  })
  @ApiParam({ name: 'id', description: 'ID do interessado (Owner)' })
  @ApiParam({ name: 'fairId', description: 'ID da feira vinculada' })
  @ApiResponse({ status: 200, description: 'Vínculo atualizado com sucesso.' })
  update(
    @Param('id') ownerId: string,
    @Param('fairId') fairId: string,
    @Body() dto: UpdateOwnerFairDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(ownerId, fairId, dto, user);
  }

  @Delete(':fairId')
  @ApiOperation({
    summary: 'Remover vínculo entre interessado e feira',
    description:
      'Remove o vínculo Owner↔Fair, revogando autorização e removendo dados associados (slots/plano/parcelas).',
  })
  @ApiParam({ name: 'id', description: 'ID do interessado (Owner)' })
  @ApiParam({ name: 'fairId', description: 'ID da feira vinculada' })
  @ApiResponse({ status: 200, description: 'Vínculo removido com sucesso.' })
  remove(
    @Param('id') ownerId: string,
    @Param('fairId') fairId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(ownerId, fairId, user);
  }
}
