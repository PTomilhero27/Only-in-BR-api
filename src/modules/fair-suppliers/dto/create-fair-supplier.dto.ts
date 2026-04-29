import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PixKeyType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FairSupplierInstallmentDto } from './fair-supplier-installment.dto';

/**
 * DTO para cadastrar fornecedor/prestador de uma feira.
 * Fornecedores sao por feira; expositores nao usam este cadastro.
 */
export class CreateFairSupplierDto {
  @ApiProperty({
    description: 'Nome do fornecedor/prestador.',
    example: 'Fornecedor XPTO',
  })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'CPF/CNPJ normalizado do favorecido.',
    example: '12345678000199',
  })
  @IsString()
  @MaxLength(32)
  document!: string;

  @ApiPropertyOptional({ nullable: true, example: 'financeiro@xpto.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '11999999999' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiProperty({
    enum: PixKeyType,
    description: 'Tipo da chave PIX usada na remessa.',
  })
  @IsEnum(PixKeyType)
  pixKeyType!: PixKeyType;

  @ApiProperty({
    description: 'Chave PIX usada para gerar o arquivo.',
    example: '12345678000199',
  })
  @IsString()
  @MaxLength(255)
  pixKey!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Servico de seguranca da feira.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({ type: [FairSupplierInstallmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FairSupplierInstallmentDto)
  installments!: FairSupplierInstallmentDto[];
}
