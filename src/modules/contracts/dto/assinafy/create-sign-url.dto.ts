import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * DTO responsável por solicitar a geração (ou reutilização) do link de assinatura do contrato.
 * Fluxo esperado:
 * - o PDF do contrato já foi enviado e salvo em Contract.pdfPath
 * - este endpoint cria/recupera signer + document e gera o signUrl
 */
export class CreateAssinafySignUrlDto {
  @ApiProperty({ example: '2d8b6c2a-5a4b-4d52-8e1a-0a5b9a6b9d11', description: 'ID da feira (Fair.id)' })
  @IsUUID()
  fairId: string;

  @ApiProperty({ example: 'ckzowner123', description: 'ID do expositor (Owner.id)' })
  @IsString()
  @MinLength(1)
  ownerId: string;

  @ApiProperty({ example: 'Maria da Silva', description: 'Nome do signatário (expositor)' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'maria@email.com', description: 'E-mail do signatário' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'Only In BR Foods',
    description: 'Nome/brand opcional para compor o filename do PDF enviado à Assinafy',
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Expiração (ISO) do assignment/link (opcional). Se omitido, não envia expiração.',
  })
  @IsOptional()
  @IsISO8601()
  expiresAtISO?: string;
}
