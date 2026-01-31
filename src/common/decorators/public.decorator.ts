/**
 * @Public()
 * Marca rotas que NÃO exigem autenticação.
 * Como o sistema é 100% autenticado, isso será usado apenas no /auth/*.
 */
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
