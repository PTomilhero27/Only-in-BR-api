import { IsNotEmpty, IsString } from 'class-validator';

export class AccessMagicLinkDto {
  @IsNotEmpty()
  @IsString()
  accessCode: string;
}
