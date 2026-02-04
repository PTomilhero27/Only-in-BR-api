import { ApiProperty } from '@nestjs/swagger'
import { IsUUID } from 'class-validator'

export class UpsertFairContractSettingsDto {
  @ApiProperty({
    description:
      'ID do template principal (não-aditivo) que será usado como contrato padrão da feira.',
    example: '8da54174-bb87-4c98-8846-52557cedea96',
  })
  @IsUUID('4', { message: 'templateId deve ser um UUID válido.' })
  templateId: string
}
