import { LinkStallParamsDto } from './link-stall.params.dto'

/**
 * Params para desvincular barraca de uma feira.
 * Mesma estrutura do link, muda apenas o verbo HTTP (DELETE).
 */
export class UnlinkStallParamsDto extends LinkStallParamsDto {}
