import { Body, Controller, Param, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from 'src/common/decorators/current-user.decorator'
import { type JwtPayload } from 'src/common/types/jwt-payload.type'
import { UpsertFairContractSettingsDto } from '../dto/templates/upsert-fair-contract-settings.dto'
import { DocumentTemplatesService } from '../services/document-templates.service'

@ApiTags('FairContractSettings')
@ApiBearerAuth()
@Controller('fairs/:fairId/contract-settings')
export class FairContractSettingsController {
  constructor(private readonly service: DocumentTemplatesService) {}

  @Patch()
  @ApiOperation({
    summary: 'Vincular/alterar contrato principal da feira',
    description:
      'Define qual template principal (não-aditivo) será usado como contrato padrão para todos os expositores da feira. ' +
      'Se já existir vínculo, ele será substituído (upsert).',
  })
  @ApiParam({ name: 'fairId', example: 'b494d390-dfb5-43c0-84b0-479259c79694' })
  @ApiResponse({ status: 200, description: 'Vínculo atualizado com sucesso.' })
  upsert(
    @Param('fairId') fairId: string,
    @Body() dto: UpsertFairContractSettingsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.upsert(fairId, dto, user.sub)
  }
}
