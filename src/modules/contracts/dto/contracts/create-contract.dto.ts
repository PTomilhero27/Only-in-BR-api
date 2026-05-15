import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ContractType } from '@prisma/client';

/**
 * DTO para criação de contrato com tipo específico.
 *
 * Tipos possíveis:
 * - FAIR_DEFAULT: contrato padrão da feira (herda template do FairContractSettings).
 * - MULTI_FAIR: contrato unificado que cobre 2+ feiras.
 * - EXHIBITOR_SPECIFIC: contrato personalizado para um expositor.
 */
export class CreateContractDto {
  @ApiProperty({
    description: 'ID do OwnerFair (vínculo expositor ↔ feira principal).',
    example: 'cm1abc...',
  })
  @IsString()
  @IsNotEmpty()
  ownerFairId!: string;

  @ApiProperty({
    description: 'ID do template a ser usado.',
    example: 'fcb5913a-...',
  })
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @ApiProperty({
    description: 'Tipo do contrato.',
    enum: ContractType,
    example: 'EXHIBITOR_SPECIFIC',
  })
  @IsEnum(ContractType)
  type!: ContractType;

  @ApiProperty({
    description: 'Título/nome customizado do contrato (útil na UI).',
    example: 'Contrato especial - Expositor João',
    required: false,
    maxLength: 300,
  })
  @IsString()
  @IsOptional()
  @MaxLength(300)
  title?: string;

  @ApiProperty({
    description: 'Observações internas do admin.',
    required: false,
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({
    description:
      'IDs de feiras adicionais cobertas (somente para MULTI_FAIR). ' +
      'Cada item é o fairId de uma feira extra.',
    example: ['b494d390-...', 'c383e291-...'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  linkedFairIds?: string[];
}
