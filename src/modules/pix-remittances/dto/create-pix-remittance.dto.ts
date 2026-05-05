import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PixRemittanceGenerationMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreatePixRemittanceItemDto } from './create-pix-remittance-item.dto';

/**
 * DTO para criar remessa PIX da feira.
 * Permite selecionar modo SINGLE ou SPLIT_TWO para gerar ate dois arquivos distintos no mesmo processo.
 */
export class CreatePixRemittanceDto {
  @ApiProperty({
    enum: PixRemittanceGenerationMode,
    description: 'Modo de geracao. SINGLE para 1 arquivo. SPLIT_TWO para dividir em 2 arquivos.',
    example: 'SINGLE'
  })
  @IsEnum(PixRemittanceGenerationMode)
  mode!: PixRemittanceGenerationMode;

  @ApiPropertyOptional({
    description: 'Data de pagamento informada no arquivo. Opcional, se nao enviar pode ser a data de execucao ou vencimentos.',
    example: '2026-05-20T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({
    description: 'Descricao administrativa da remessa.',
    example: 'Pagamento pos-evento de fornecedores',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CreatePixRemittanceItemDto], description: 'Itens (parcelas) a serem incluidos na remessa.' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePixRemittanceItemDto)
  items!: CreatePixRemittanceItemDto[];
}
