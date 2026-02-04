import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

/**
 * Resposta do upload do PDF do contrato.
 *
 * Responsabilidade:
 * - Confirmar qual instância de Contract foi utilizada/criada.
 * - Informar o caminho (pdfPath) salvo no banco, que aponta para o arquivo no Storage.
 *
 * Observação:
 * - pdfPath é a "chave" usada no Supabase Storage (bucket `contracts`).
 * - A URL pública NÃO é retornada aqui, pois o bucket é privado (MVP).
 */
export class UploadContractPdfResponseDto {
  @ApiProperty({
    example: '0f2c0c66-3c4f-4b42-9c7c-2c1a1a11c5f1',
    description:
      'ID da instância de contrato (tabela Contract) que recebeu o pdfPath. ' +
      'Pode ser uma instância criada agora (upsert) ou já existente.',
  })
  @IsUUID()
  contractId: string;

  @ApiProperty({
    example: 'b494d390-dfb5-43c0-84b0-479259c79694/50325146837/contract.pdf',
    description:
      'Caminho (storage key) do PDF no bucket `contracts` do Supabase. ' +
      'Este valor também é persistido em Contract.pdfPath.',
  })
  @IsString()
  @MinLength(1)
  pdfPath: string;
}
