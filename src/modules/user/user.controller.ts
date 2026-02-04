/**
 * UsersController
 * - /users/me: retorna usuário autenticado
 * - /users: (Admin) lista usuários do painel (role != EXHIBITOR)
 * - /users/:id: (Admin) detalhe
 * - PATCH /users/:id: (Admin) editar
 */
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './user.service';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  private assertAdmin(user: any) {
    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Acesso restrito a ADMIN.');
    }
  }

  @Get('me')
  me(@CurrentUser() user: any) {
    return user;
  }

  /**
   * GET /users
   * Lista usuários do painel (não-expositor).
   */
  @Get()
  list(@CurrentUser() user: any, @Query() dto: ListUsersDto) {
    this.assertAdmin(user);
    return this.users.listNonExhibitors(dto);
  }

  /**
   * GET /users/:id
   * Detalhe para edição.
   */
  @Get(':id')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    this.assertAdmin(user);
    if (!id) throw new BadRequestException('id obrigatório.');
    return this.users.getDetail(id);
  }

  /**
   * PATCH /users/:id
   * Edita usuário do painel.
   */
  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    this.assertAdmin(user);
    if (!id) throw new BadRequestException('id obrigatório.');
    return this.users.updateNonExhibitor(id, dto, user.id);
  }
}
