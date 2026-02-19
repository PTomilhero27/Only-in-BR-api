import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

/**
 * ✅ UpdateStallFairTaxDto
 *
 * Responsabilidade:
 * - Definir (ou limpar) a taxa aplicada a uma barraca vinculada na feira (StallFair).
 *
 * Observação:
 * - taxId opcional => permite "limpar" a taxa (enviando null/omit e usando endpoint específico, ver service).
 * - No MVP, vamos exigir taxId (não permitir limpar) se você quiser travar mais.
 */
export class UpdateStallFairTaxDto {
  @ApiProperty({
    example: 'c2b4d6f2-3a5a-4c3f-9b33-2b2b8c3c2c10',
    description:
      'ID da taxa (FairTax) que será aplicada nesta barraca. Deve pertencer à mesma feira.',
  })
  @IsString()
  @IsUUID()
  taxId!: string;

  /**
   * ✅ Se no futuro quiser permitir limpar taxa:
   * - troque o taxId para @IsOptional() e valide no service.
   */
}
