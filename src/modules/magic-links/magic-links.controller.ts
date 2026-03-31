import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MagicLinksService } from './magic-links.service';
import { CreateMagicLinkDto } from './dto/create-magic-link.dto';
import { AccessMagicLinkDto } from './dto/access-magic-link.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('magic-links')
export class MagicLinksController {
  constructor(private readonly magicLinksService: MagicLinksService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  async generateLink(
    @Body() dto: CreateMagicLinkDto,
    @CurrentUser() user: any,
  ) {
    return this.magicLinksService.generateLink(dto.fairId, user.id);
  }

  @Post(':id/access')
  async accessLink(@Param('id') id: string, @Body() dto: AccessMagicLinkDto) {
    return this.magicLinksService.accessLink(id, dto.accessCode);
  }
}
