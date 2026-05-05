import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PixRemittanceStatus, PixRemittanceGenerationMode } from '@prisma/client';
import { PixRemittanceItemResponseDto } from './pix-remittance-item-response.dto';

export class PixRemittanceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fairId!: string;

  @ApiProperty({ enum: PixRemittanceStatus })
  status!: PixRemittanceStatus;

  @ApiPropertyOptional({ enum: PixRemittanceGenerationMode })
  generationMode?: PixRemittanceGenerationMode;

  @ApiPropertyOptional()
  groupNumber?: number;

  @ApiPropertyOptional()
  fileName?: string;

  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  totalAmountCents!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  paidAt?: Date;

  @ApiPropertyOptional()
  cancelledAt?: Date;

  @ApiProperty({ type: [PixRemittanceItemResponseDto] })
  items!: PixRemittanceItemResponseDto[];
}
