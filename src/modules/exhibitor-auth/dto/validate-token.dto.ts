import { IsNotEmpty, IsString } from 'class-validator'

/**
 * DTO para validação de token temporário.
 */
export class ValidateTokenDto {
  /**
   * Token bruto recebido via query (?token=...)
   */
  @IsString()
  @IsNotEmpty()
  token!: string
}
