import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

/**
 * Params para desvincular barraca de uma feira no portal.
 */
export class UnlinkStallParamsDto {
  @ApiProperty({
    example: '5c4b9a3a-2d13-4c8b-9a4e-7d4f6a7e8b9c',
    description: 'ID da feira.',
  })
  @IsString()
  fairId!: string

  @ApiProperty({
    example: 'ckv7w3z5p0001q8l1p2abcxyz',
    description: 'ID da barraca.',
  })
  @IsString()
  stallId!: string
}
