import { PartialType } from '@nestjs/swagger';
import { CreateInventoryItemDto } from './create-inventory-item.dto';

/**
 * DTO de edicao cadastral do item.
 * A quantidade tambem e aceita aqui para ajustes administrativos pontuais, mas fluxos operacionais devem usar movimentacoes.
 */
export class UpdateInventoryItemDto extends PartialType(CreateInventoryItemDto) {}
