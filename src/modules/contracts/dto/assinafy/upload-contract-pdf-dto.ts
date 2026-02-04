import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadContractPdfDto {
  @ApiProperty({ example: 'f0f8c1d0-0000-0000-0000-000000000000' })
  @IsUUID()
  fairId!: string;

  @ApiProperty({ example: 'owner_123' })
  @IsString()
  ownerId!: string;

  @ApiPropertyOptional({
    description:
      'ID do contrato (Contract.id). Se não informado, o sistema cria/acha pelo OwnerFair.',
    example: '8b0b6d8f-8c7f-4c2a-9a5e-1b5d8c2fdc1a',
  })
  @IsOptional()
  @IsUUID()
  contractId?: string;
}
