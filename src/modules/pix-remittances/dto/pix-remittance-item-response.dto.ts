import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PixKeyType, PixRemittancePayeeType } from '@prisma/client';

export class PixRemittanceItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  pixRemittanceId!: string;

  @ApiProperty({ enum: PixRemittancePayeeType })
  payeeType!: PixRemittancePayeeType;

  @ApiPropertyOptional()
  supplierInstallmentId?: string;

  @ApiPropertyOptional()
  exhibitorPayoutId?: string;

  @ApiProperty()
  amountCents!: number;

  @ApiProperty()
  payeeName!: string;

  @ApiProperty()
  payeeDocument!: string;

  @ApiProperty({ enum: PixKeyType })
  pixKeyType!: PixKeyType;

  @ApiProperty()
  pixKey!: string;

  @ApiPropertyOptional()
  txId?: string;

  @ApiProperty()
  createdAt!: Date;
}
