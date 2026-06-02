import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO de cancelamento da reserva.
 * Cancela bloqueios futuros sem alterar estoque ja retirado.
 */
export class CancelInventoryReservationDto {
  @ApiPropertyOptional({ example: 'Evento cancelado pelo organizador.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
