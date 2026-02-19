import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsString, Min } from 'class-validator';

/**
 * Taxa da feira (FairTax) para o Portal.
 *
 * Por que existe:
 * - O portal precisa exibir a taxa aplicada (snapshot) e/ou opções ativas da feira.
 */
export class ExhibitorFairTaxDto {
  @ApiProperty({
    example: 'f0c1b2a3-1234-5678-9abc-000000000000',
    description: 'ID da taxa.',
  })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'Taxa padrão', description: 'Nome da taxa.' })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 500,
    description: 'Percentual em basis points. Ex.: 500 = 5%.',
  })
  @IsInt()
  @Min(0)
  percentBps!: number;

  @ApiProperty({
    example: true,
    description: 'Se está ativa para uso na feira.',
  })
  @IsBoolean()
  isActive!: boolean;
}
