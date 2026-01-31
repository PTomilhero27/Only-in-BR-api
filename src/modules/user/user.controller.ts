/**
 * UsersController
 * Endpoint mínimo para validar autenticação: /users/me
 */
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UsersController {
  @Get('me')
  me(@CurrentUser() user: any) {
    return user;
  }
}
