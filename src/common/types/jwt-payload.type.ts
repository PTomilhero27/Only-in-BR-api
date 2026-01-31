/**
 * JwtPayload
 * Payload mínimo para manter o token enxuto e seguro.
 */

export type JwtPayload = {
  id: string; // userId
  sub: string; // userId
  email: string;
  role: string;
};
