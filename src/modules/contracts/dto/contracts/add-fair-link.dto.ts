import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO para adicionar uma feira ao contrato MULTI_FAIR.
 */
export class AddFairLinkDto {
  @ApiProperty({
    description: 'ID da feira adicional a vincular.',
    example: 'b494d390-dfb5-43c0-84b0-479259c79694',
  })
  @IsString()
  @IsNotEmpty()
  fairId!: string;

  @ApiProperty({
    description:
      'ID do OwnerFair do expositor nesta feira adicional (opcional, para rastreabilidade).',
    required: false,
    example: 'cm1xyz...',
  })
  @IsString()
  @IsOptional()
  ownerFairId?: string;
}
