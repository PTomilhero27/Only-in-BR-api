import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsDateString,
  Min,
  IsInt,
} from 'class-validator';
import { FairStatus } from '@prisma/client';

/**
 * Representa uma janela de funcionamento da feira
 * (ex.: um dia específico com horário de abertura e fechamento).
 */
export class CreateFairOccurrenceDto {
  @ApiProperty({
    example: '2026-01-14T10:00:00-03:00',
    description: 'Data e hora de início da ocorrência (ISO 8601).',
  })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({
    example: '2026-01-14T22:00:00-03:00',
    description: 'Data e hora de fim da ocorrência (ISO 8601).',
  })
  @IsDateString()
  endsAt!: string;
}

/**
 * DTO para criação de uma feira.
 *
 * A fonte da verdade do calendário são as occurrences.
 * Permite dias não-contíguos (ex.: 14, 16 e 17).
 */
export class CreateFairDto {
  @ApiProperty({
    example: 'Feira Gastronômica de Verão',
    description: 'Nome da feira.',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    enum: FairStatus,
    example: FairStatus.ATIVA,
    description: 'Status da feira (opcional).',
  })
  @IsEnum(FairStatus)
  @IsOptional()
  status?: FairStatus;

  @ApiProperty({
    example: 'Av. Central, 123 - Centro',
    description: 'Endereço onde a feira acontece.',
  })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({
    description: 'Lista de datas e horários da feira.',
    example: [
      {
        startsAt: '2026-01-14T10:00:00-03:00',
        endsAt: '2026-01-14T22:00:00-03:00',
      },
      {
        startsAt: '2026-01-16T10:00:00-03:00',
        endsAt: '2026-01-16T22:00:00-03:00',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFairOccurrenceDto)
  occurrences!: CreateFairOccurrenceDto[];


  @ApiProperty({
    example: 120,
    description: 'Capacidade máxima de barracas disponíveis nesta feira.',
  })
  @IsInt()
  @Min(0)
  stallsCapacity!: number
}
