/**
 * @CurrentUser()
 * Retorna o usuário autenticado (req.user) populado pela JwtStrategy.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
