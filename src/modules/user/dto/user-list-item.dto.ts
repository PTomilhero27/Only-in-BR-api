import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * UserListItemDto
 * Item simplificado para tabela admin.
 */
export class UserListItemDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Maria Silva', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 'maria@onlyinbr.com.br' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ADMIN })
  role!: UserRole;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-02-04T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-02-04T10:00:00.000Z' })
  updatedAt!: Date;
}
