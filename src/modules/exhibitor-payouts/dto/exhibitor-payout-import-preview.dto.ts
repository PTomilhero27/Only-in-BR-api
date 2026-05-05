import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExhibitorPayoutImportPreviewDataDto {
  @ApiPropertyOptional()
  payoutId?: string;

  @ApiProperty()
  ownerFairId!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  holderName!: string;

  @ApiProperty()
  holderDocument!: string;

  @ApiProperty()
  pixKey!: string;

  @ApiProperty()
  pixKeyType!: string;

  @ApiProperty()
  pixKeyConfidence!: string;

  @ApiProperty()
  grossAmountCents!: number;

  @ApiProperty()
  netAmountCents!: number;
}

export class ExhibitorPayoutImportPreviewRowDto {
  @ApiProperty()
  rowNumber!: number;

  @ApiProperty({ example: 'CREATE' })
  action!: 'CREATE' | 'UPDATE';

  @ApiProperty({ example: 'VALID' })
  status!: 'VALID' | 'INVALID' | 'WARNING';

  @ApiProperty({ type: ExhibitorPayoutImportPreviewDataDto })
  payout!: ExhibitorPayoutImportPreviewDataDto;

  @ApiProperty({ type: [String] })
  errors!: string[];

  @ApiProperty({ type: [String] })
  warnings!: string[];
}

export class ExhibitorPayoutImportPreviewSummaryDto {
  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  validCount!: number;

  @ApiProperty()
  newCount!: number;

  @ApiProperty()
  updateCount!: number;

  @ApiProperty()
  errorCount!: number;

  @ApiProperty()
  warningCount!: number;
}

export class ExhibitorPayoutImportPreviewResponseDto {
  @ApiProperty({ type: ExhibitorPayoutImportPreviewSummaryDto })
  summary!: ExhibitorPayoutImportPreviewSummaryDto;

  @ApiProperty({ type: [ExhibitorPayoutImportPreviewRowDto] })
  rows!: ExhibitorPayoutImportPreviewRowDto[];
}
