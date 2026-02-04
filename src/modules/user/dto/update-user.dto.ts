import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * UpdateUserDto
 * Admin pode editar dados básicos do usuário.
 *
 * Regras sugeridas:
 * - role EXHIBITOR não deve ser setado aqui (fluxo do portal/owner).
 * - se futuramente quiser habilitar, validar ownerId.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'Maria Silva',
    description: 'Nome exibido do usuário.',
  })
  @IsOptional()
  @IsString({ message: 'name deve ser texto.' })
  name?: string;

  @ApiPropertyOptional({
    example: 'maria@onlyinbr.com.br',
    description: 'E-mail do usuário (único).',
  })
  @IsOptional()
  @IsEmail({}, { message: 'email inválido.' })
  email?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    example: UserRole.ADMIN,
    description: 'Role do usuário. (Por enquanto, manter ADMIN para painel.)',
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'role inválido.' })
  role?: UserRole;

  @ApiPropertyOptional({
    example: true,
    description: 'Ativar/desativar acesso do usuário.',
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive deve ser boolean.' })
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'NovaSenha@123',
    description:
      'Opcional: define nova senha (gera hash). Se informado, atualiza passwordSetAt.',
  })
  @IsOptional()
  @IsString({ message: 'password deve ser texto.' })
  @MinLength(6, { message: 'password deve ter pelo menos 6 caracteres.' })
  password?: string;
}
