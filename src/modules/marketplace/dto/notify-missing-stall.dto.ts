import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class NotifyMissingStallDto {
  @ApiPropertyOptional({
    description:
      'Força o envio mesmo que um alerta recente já tenha sido disparado.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({
    description: 'Observação opcional do admin para personalizar o e-mail.',
    example: 'Precisamos da barraca vinculada ainda hoje para liberar o mapa.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
