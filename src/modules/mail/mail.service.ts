import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtps.uol.com.br',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true, // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      this.logger.warn(
        'SMTP_USER e SMTP_PASS não configurados nas variáveis de ambiente. Email ignorado.',
      );
      this.logger.warn(`(Mock) Email subject: ${subject}`);
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Feiras BR" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });

      this.logger.log(`Email enviado: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Erro ao enviar email para ${to}:`, error);
      return false;
    }
  }
}
