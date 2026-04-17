import { ApiProperty } from '@nestjs/swagger';

/**
 * VerifyEmailResponseDto
 *
 * Responsabilidade:
 * - Retornar confirmação de verificação de email.
 */
export class VerifyEmailResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}
