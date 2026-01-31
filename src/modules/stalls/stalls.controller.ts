// src/modules/stalls/stalls.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from 'src/common/decorators/current-user.decorator'
import type { JwtPayload } from 'src/common/types/jwt-payload.type'

import { StallsService } from './stalls.service'
import { ListStallsResponseDto } from './dto/list-stalls-response.dto'
import { UpsertStallDto } from './dto/upsert-stall.dto'
import { UpsertStallResponseDto } from './dto/upsert-stall-response.dto'
import { DeleteStallResponseDto } from './dto/delete-stall-response.dto'

/**
 * Controller autenticado de Barracas (Portal do Expositor).
 *
 * Responsabilidade:
 * - CRUD das barracas do expositor logado (Owner via User.ownerId).
 *
 * Importante:
 * - Sem rotas públicas.
 * - Autorização é pelo token JWT (role EXHIBITOR).
 */
@ApiTags('Stalls')
@ApiBearerAuth()
@Controller('stalls')
export class StallsController {
  constructor(private readonly service: StallsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar minhas barracas (expositor logado)' })
  listMine(@CurrentUser() user: JwtPayload): Promise<ListStallsResponseDto> {
    return this.service.listByMe(user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Criar barraca (expositor logado)' })
  createMine(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertStallDto,
  ): Promise<UpsertStallResponseDto> {
    return this.service.createByMe(user.id, dto)
  }

  @Patch(':stallId')
  @ApiOperation({ summary: 'Editar barraca (expositor logado)' })
  updateMine(
    @CurrentUser() user: JwtPayload,
    @Param('stallId') stallId: string,
    @Body() dto: UpsertStallDto,
  ): Promise<UpsertStallResponseDto> {
    return this.service.updateByMe(user.id, stallId, dto)
  }

  @Delete(':stallId')
  @ApiOperation({ summary: 'Excluir barraca (expositor logado)' })
  removeMine(
    @CurrentUser() user: JwtPayload,
    @Param('stallId') stallId: string,
  ): Promise<DeleteStallResponseDto> {
    return this.service.removeByMe(user.id, stallId)
  }
}
