import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class MagicLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Gera um código de acesso de 6 dígitos.
   */
  private generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async generateLink(fairId: string, adminUserId: string) {
    const fair = await this.prisma.fair.findUnique({ where: { id: fairId } });
    if (!fair) throw new NotFoundException('Feira não encontrada');

    const pin = this.generatePin();

    const magicLink = await this.prisma.fairMagicLink.create({
      data: {
        fairId,
        accessCode: pin,
        createdByUserId: adminUserId,
      },
    });

    return {
      linkId: magicLink.id,
      accessCode: pin,
    };
  }

  async accessLink(linkId: string, accessCode: string) {
    const magicLink = await this.prisma.fairMagicLink.findUnique({
      where: { id: linkId },
      include: {
        fair: {
          include: {
            occurrences: true,
            fairMap: {
              include: {
                template: {
                  include: { elements: true },
                },
                links: {
                  include: {
                    stallFair: {
                      include: {
                        stall: true,
                        ownerFair: { include: { owner: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!magicLink || !magicLink.isActive) {
      throw new UnauthorizedException('Link mágico inválido ou inativo');
    }

    if (magicLink.accessCode !== accessCode) {
      throw new UnauthorizedException('Código de acesso incorreto');
    }

    if (!magicLink.fair.fairMap) {
      throw new BadRequestException(
        'Esta feira ainda não possui um mapa vinculado.',
      );
    }

    const now = new Date();

    // Verifica se a feira está ocorrendo com base nas ocorrências listadas
    const isHappeningNow = magicLink.fair.occurrences.some(
      (occ) => now >= occ.startsAt && now <= occ.endsAt,
    );

    // Permitindo acesso se a feira estiver ATIVA geral, e garantindo verificação das datas de ocorrência.
    if (magicLink.fair.status !== 'ATIVA' && !isHappeningNow) {
      throw new BadRequestException(
        'A feira não está ativa no momento para acessar o mapa.',
      );
    }

    // Gera o Token JWT de Convidado
    const payload = {
      sub: linkId,
      fairId: magicLink.fair.id,
      role: 'GUEST_VIEWER',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      fairInfo: {
        id: magicLink.fair.id,
        name: magicLink.fair.name,
        address: magicLink.fair.address,
      },
      mapDetails: magicLink.fair.fairMap,
    };
  }
}
