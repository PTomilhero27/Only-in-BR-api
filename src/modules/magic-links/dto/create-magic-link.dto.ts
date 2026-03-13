import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateMagicLinkDto {
  @IsNotEmpty()
  @IsUUID()
  fairId: string;
}
