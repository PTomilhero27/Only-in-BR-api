import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OwnerFairPaymentStatus, StallSize } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Barraca vinculada (StallFair) para exibição no portal.
 *
 * Observação:
 * - Cada StallFair consome exatamente 1 OwnerFairPurchase (purchaseId).
 * - Aqui enviamos um resumo do pagamento/compra consumida para a UI.
 */
export class ExhibitorLinkedStallDto {
  @ApiProperty({
    example: 'ckv7w3z5p0001q8l1p2abcxyz',
    description: 'ID da barraca (Stall).',
  })
  @IsString()
  stallId!: string;

  @ApiProperty({ example: 'Pastel do Zé', description: 'Nome PDV da barraca.' })
  @IsString()
  pdvName!: string;

  @ApiProperty({
    enum: StallSize,
    example: StallSize.SIZE_3X3,
    description: 'Tamanho da barraca.',
  })
  @IsEnum(StallSize)
  stallSize!: StallSize;

  @ApiProperty({
    example: '2026-02-03T12:34:56.000Z',
    description: 'Quando foi vinculada (ISO).',
  })
  @IsString()
  linkedAt!: string;

  @ApiPropertyOptional({
    example: 'ckx9p3z5p0001q8l1p2abcxyz',
    description: 'Compra (OwnerFairPurchase) consumida por este vínculo.',
  })
  @IsOptional()
  @IsString()
  purchaseId!: string | null;

  @ApiPropertyOptional({
    enum: OwnerFairPaymentStatus,
    example: OwnerFairPaymentStatus.PARTIALLY_PAID,
    description: 'Status financeiro da compra consumida.',
  })
  @IsOptional()
  @IsEnum(OwnerFairPaymentStatus)
  purchaseStatus!: OwnerFairPaymentStatus | null;

  @ApiPropertyOptional({
    example: 150000,
    description: 'Preço unitário da compra (centavos).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  purchaseUnitPriceCents!: number | null;

  @ApiPropertyOptional({
    example: 150000,
    description: 'Total da compra (centavos).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  purchaseTotalCents!: number | null;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Entrada paga na compra (centavos).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  purchasePaidCents!: number | null;

  @ApiPropertyOptional({
    example: 2,
    description: 'Quantidade de parcelas da compra.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  purchaseInstallmentsCount!: number | null;

  // ---------------------------
  // ✅ Taxa por barraca vinculada (StallFair.tax + snapshot)
  // ---------------------------

  @ApiPropertyOptional({
    example: '1b2c3d4e-aaaa-bbbb-cccc-1234567890ab',
    description: 'ID da taxa aplicada nesta barraca na feira (FairTax).',
  })
  @IsOptional()
  @IsString()
  taxId!: string | null;

  @ApiPropertyOptional({
    example: 'Taxa carrinho',
    description: 'Snapshot do nome da taxa no momento do vínculo.',
  })
  @IsOptional()
  @IsString()
  taxNameSnapshot!: string | null;

  @ApiPropertyOptional({
    example: 300,
    description: 'Snapshot do percentual em bps no momento do vínculo.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  taxPercentBpsSnapshot!: number | null;
}
