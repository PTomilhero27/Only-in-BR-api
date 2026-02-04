import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UserDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true }) name!: string | null;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ nullable: true }) passwordSetAt!: Date | null;
  @ApiProperty({ nullable: true }) ownerId!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
