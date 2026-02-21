import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * DTO para vincular/trocar a planta (MapTemplate) usada por uma feira.
 */
export class SetFairMapTemplateDto {
  @ApiProperty({
    example: 'ckv_template_123',
    description: 'ID do MapTemplate que será usado por esta feira.',
  })
  @IsString()
  templateId!: string;
}
