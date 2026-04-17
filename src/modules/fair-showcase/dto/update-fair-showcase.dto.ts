import { PartialType } from '@nestjs/swagger';
import { CreateFairShowcaseDto } from './create-fair-showcase.dto';

/**
 * UpdateFairShowcaseDto
 *
 * Mesmos campos do Create, todos opcionais (PATCH parcial).
 */
export class UpdateFairShowcaseDto extends PartialType(CreateFairShowcaseDto) {}
