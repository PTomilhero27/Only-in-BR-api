import { ApiProperty } from '@nestjs/swagger';
import { UserListItemDto } from './user-list-item.dto';

/**
 * ListUsersResponseDto
 * Resposta paginada.
 */
export class ListUsersResponseDto {
  @ApiProperty({ type: [UserListItemDto] })
  items!: UserListItemDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 123 })
  total!: number;
}
