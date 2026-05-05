import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class MarkPixRemittancePaidDto {
  @ApiProperty({
    description: 'Data e hora que a remessa foi efetivamente paga no banco.',
    example: '2026-05-20T14:30:00.000Z',
  })
  @IsDateString()
  paidAt!: string;
}
