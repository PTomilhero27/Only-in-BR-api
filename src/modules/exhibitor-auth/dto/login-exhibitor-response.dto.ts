import { ApiProperty } from '@nestjs/swagger'

/**
 * Resposta do login do expositor.
 *
 * Decisão:
 * - Retornamos accessToken (JWT) e owner mínimo para UX.
 * - Evita necessidade imediata de /me.
 */
export class LoginExhibitorResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT de acesso do expositor.',
  })
  accessToken: string

  @ApiProperty({
    description: 'Dados mínimos do Owner logado.',
    example: {
      id: 'ckx...',
      personType: 'PF',
      document: '12345678901',
      fullName: 'João da Silva',
      email: 'feirante@exemplo.com',
    },
  })
  owner: {
    id: string
    personType: 'PF' | 'PJ'
    document: string
    fullName?: string | null
    email?: string | null
  }
}
