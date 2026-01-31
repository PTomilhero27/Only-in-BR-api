import { IsNotEmpty, IsString, MinLength } from 'class-validator'

/**
 * DTO para definição de senha via token.
 */
export class SetPasswordDto {
  /**
   * Token temporário válido.
   */
  @IsString()
  @IsNotEmpty()
  token!: string

  /**
   * Nova senha do expositor.
   * Regra MVP: mínimo 8 caracteres.
   */
  @IsString()
  @MinLength(8)
  password!: string
}
