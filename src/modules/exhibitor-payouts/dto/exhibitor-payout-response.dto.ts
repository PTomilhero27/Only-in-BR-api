import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExhibitorPayoutStatus, PixKeyType } from '@prisma/client';

/**
 * Resposta administrativa de repasse de expositor.
 * Junta dados do Owner/OwnerFair com o controle financeiro do ExhibitorPayout.
 */
export class ExhibitorPayoutResponseDto {
  @ApiProperty()
  ownerFairId!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiPropertyOptional()
  name!: string | null;

  @ApiProperty()
  document!: string;

  @ApiPropertyOptional()
  email!: string | null;

  @ApiPropertyOptional()
  phone!: string | null;

  @ApiPropertyOptional({ enum: PixKeyType, nullable: true })
  pixKeyType!: PixKeyType | null;

  @ApiPropertyOptional({ nullable: true })
  pixKey!: string | null;

  @ApiProperty()
  grossAmountCents!: number;

  @ApiProperty()
  discountAmountCents!: number;

  @ApiProperty()
  adjustmentAmountCents!: number;

  @ApiProperty()
  netAmountCents!: number;

  @ApiProperty()
  paidAmountCents!: number;

  @ApiProperty()
  pendingAmountCents!: number;

  @ApiProperty({ enum: ExhibitorPayoutStatus })
  status!: ExhibitorPayoutStatus;

  @ApiPropertyOptional({ nullable: true })
  dueDate!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  paidAt!: Date | null;
}
