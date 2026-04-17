import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { StallSize } from '@prisma/client';

export class CreateReservationDto {
  @ApiPropertyOptional({ description: 'ID da barraca que o expositor deseja vincular' })
  @IsOptional()
  @IsString()
  stallId?: string;

  @ApiPropertyOptional({ description: 'Tipo/Tamanho da barraca selecionado', enum: StallSize })
  @IsOptional()
  @IsEnum(StallSize)
  selectedTentType?: StallSize;
}
