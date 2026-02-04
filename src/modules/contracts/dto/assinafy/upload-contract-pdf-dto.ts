import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

/**
 * Upload do PDF do contrato (MVP)
 *
 * Responsabilidade:
 * - Receber metadados mínimos para validar:
 *   - se o owner está vinculado à feira (OwnerFair)
 *   - se o template é o da feira (opcional, mas recomendado)
 *   - se o contrato que vamos salvar pertence a esse vínculo
 */
export class UploadContractPdfDto {
  @ApiProperty({
    example: 'b494d390-dfb5-43c0-84b0-479259c79694',
    description: 'ID da feira (UUID).',
  })
  @IsUUID()
  fairId: string;

  @ApiProperty({
    example: 'cml3zitip0000rkwkdy6f4smm',
    description: 'ID do owner (expositor).',
  })
  @IsString()
  @MinLength(1)
  ownerId: string;

  @ApiProperty({
    example: '8da54174-bb87-4c98-8846-52557cedea96',
    description: 'ID do template de contrato (UUID).',
  })
  @IsUUID()
  templateId: string;
}
