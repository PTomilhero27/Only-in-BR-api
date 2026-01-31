import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUUID } from 'class-validator'

/**
 * Params para vincular barraca em uma feira.
 * Usamos params pois a operação é direta: /:fairId/stalls/:stallId
 */
export class LinkStallParamsDto {
  @ApiProperty({
    description: 'ID da feira (UUID v4).',
    example: 'b7b7e9a0-4e44-4c5c-9e4e-0caa5d2f1e1a',
  })
  @IsUUID('4', { message: 'fairId deve ser um UUID v4 válido.' })
  fairId: string

  @ApiProperty({
    description: 'ID da barraca do expositor (cuid).',
    example: 'ckz8y2w2k0001u9a9abcd1234',
  })
  @IsString({ message: 'stallId deve ser uma string.' })
  stallId: string
}
