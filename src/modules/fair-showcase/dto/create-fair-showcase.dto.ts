import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BenefitItemDto {
  @ApiProperty({ example: 'Users' })
  @IsString()
  icon: string;

  @ApiProperty({ example: 'Público estimado: 50 mil pessoas' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Evento com grande fluxo de visitantes.' })
  @IsString()
  description: string;
}

export class FaqItemDto {
  @ApiProperty({ example: 'Como funciona a reserva?' })
  @IsString()
  question: string;

  @ApiProperty({ example: 'Você demonstra interesse e nossa equipe entra em contato.' })
  @IsString()
  answer: string;
}

/**
 * CreateFairShowcaseDto
 *
 * Todos os campos são opcionais para permitir criação incremental
 * (admin cria a vitrine e vai preenchendo aos poucos).
 */
export class CreateFairShowcaseDto {
  @ApiPropertyOptional({ example: 'A maior feira gastronômica da região' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional({
    example: 'O Festival reúne os melhores expositores da região...',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'Festival de inverno com +80 espaços. Inscrições abertas!',
  })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'https://supabase.co/storage/v1/...' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://supabase.co/storage/v1/...'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImageUrls?: string[];

  @ApiPropertyOptional({ type: [BenefitItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BenefitItemDto)
  benefits?: BenefitItemDto[];

  @ApiPropertyOptional({ type: [FaqItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faq?: FaqItemDto[];

  @ApiPropertyOptional({ example: '5541999999999' })
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @ApiPropertyOptional({ example: 'Curitiba' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'PR' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: -25.4231 })
  @IsOptional()
  @IsNumber()
  locationLat?: number;

  @ApiPropertyOptional({ example: -49.3099 })
  @IsOptional()
  @IsNumber()
  locationLng?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
