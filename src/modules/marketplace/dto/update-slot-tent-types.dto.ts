import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StallSize } from '@prisma/client';

export class SlotTentTypeConfigDto {
  @ApiProperty({ enum: StallSize })
  @IsEnum(StallSize)
  tentType: StallSize;

  @ApiProperty()
  @IsInt()
  @Min(0)
  priceCents: number;
}

export class UpdateSlotTentTypesDto {
  @ApiProperty({ type: [SlotTentTypeConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotTentTypeConfigDto)
  configurations: SlotTentTypeConfigDto[];
}
