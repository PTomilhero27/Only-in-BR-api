import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'

/**
 * Status do contrato exibido no Portal do Expositor.
 *
 * Observação:
 * - Contrato é por OwnerFair (por feira/expositor), não por barraca.
 */
export enum ExhibitorFairContractStatus {
  NOT_ISSUED = 'NOT_ISSUED',
  ISSUED = 'ISSUED',
  AWAITING_SIGNATURE = 'AWAITING_SIGNATURE',
  SIGNED = 'SIGNED',
}

export class ExhibitorFairContractSummaryDto {
  @ApiProperty({
    example: 'f3f4c2a1-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    description: 'ID do contrato.',
  })
  @IsString()
  contractId!: string

  @ApiProperty({
    enum: ExhibitorFairContractStatus,
    example: ExhibitorFairContractStatus.AWAITING_SIGNATURE,
    description: 'Status derivado para UX do portal.',
  })
  @IsEnum(ExhibitorFairContractStatus)
  status!: ExhibitorFairContractStatus

  @ApiPropertyOptional({
    example: 'contracts/2026/02/contract-abc.pdf',
    description:
      'Caminho do PDF no storage. Recomendação: usar endpoint que gere URL segura/assinada no portal.',
  })
  @IsOptional()
  @IsString()
  pdfPath!: string | null

  @ApiPropertyOptional({
    example: 'https://assinafy.com/sign/xyz',
    description:
      'Link de assinatura (se existir e não estiver expirado). Se expirado, o backend retorna null.',
  })
  @IsOptional()
  @IsString()
  signUrl!: string | null

  @ApiPropertyOptional({
    example: '2026-02-10T23:59:59.000Z',
    description: 'Expiração do link de assinatura (ISO).',
  })
  @IsOptional()
  @IsString()
  signUrlExpiresAt!: string | null

  @ApiPropertyOptional({
    example: '2026-02-03T12:34:56.000Z',
    description: 'Quando o contrato foi marcado como assinado no OwnerFair (ISO).',
  })
  @IsOptional()
  @IsString()
  signedAt!: string | null

  @ApiProperty({
    example: '2026-02-03T12:34:56.000Z',
    description: 'Última atualização do contrato (ISO).',
  })
  @IsString()
  updatedAt!: string
}
