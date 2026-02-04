import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

class AssinafyWebhookObjectDto {
  @ApiProperty({ example: 'efo39340da030af0g' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 'document.pdf' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'document' })
  @IsString()
  @IsOptional()
  type?: string;
}

class AssinafyWebhookSubjectDto {
  @ApiProperty({ example: 'efo39340da030af0g' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'user' })
  @IsString()
  @IsOptional()
  type?: string;
}

export class AssinafyWebhookDto {
  @ApiProperty({ example: 987 })
  @IsInt()
  id: number;

  @ApiProperty({
    example: 'document_ready',
    description: 'Tipo do evento enviado pela Assinafy.',
  })
  @IsString()
  @IsIn([
    'document_prepared',
    'document_metadata_ready',
    'document_ready',
    'document_uploaded',
    'signature_requested',
    'signer_created',
    'signer_email_verified',
    'signer_signed_document',
    'signer_rejected_document',
    'signer_viewed_document',
    'document_processing_failed',
  ])
  event: string;

  @ApiProperty({ type: AssinafyWebhookObjectDto })
  @IsObject()
  object: AssinafyWebhookObjectDto;

  @ApiProperty({ type: AssinafyWebhookSubjectDto })
  @IsObject()
  subject: AssinafyWebhookSubjectDto;

  @ApiProperty({ example: 'o39340do39340d' })
  @IsString()
  @IsNotEmpty()
  account_id: string;
}
