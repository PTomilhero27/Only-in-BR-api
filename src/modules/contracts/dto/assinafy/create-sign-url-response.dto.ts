import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de resposta padronizada para o link de assinatura.
 * Retorna IDs úteis para debug/auditoria e flags de reutilização.
 */
export class CreateAssinafySignUrlResponseDto {
  @ApiProperty({ example: 'https://app.assinafy.com.br/sign/123' })
  signUrl: string;

  @ApiProperty({ example: 'c0a80123-aaaa-bbbb-cccc-1234567890ab' })
  contractId: string;

  @ApiProperty({ example: '12345' })
  assinafyDocumentId: string;

  @ApiProperty({ example: '67890' })
  assinafySignerId: string;

  @ApiProperty({ example: false })
  reused: boolean;
}
