import 'dotenv/config'
import nodemailer from 'nodemailer'

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  console.log('Testando conexão SMTP e envio de email...')
  console.log({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    user: '(configurado)',
    pass: '(configurado)',
  })

  await transporter.verify()

  const from = process.env.SMTP_USER!

  const info = await transporter.sendMail({
    from: from,
    sender: from,
    to: 'ptomilhero27@gmail.com',
    subject: 'Teste SMTP Only in BR',
    text: 'Teste de envio do marketplace.',
    html: '<p>Teste de envio do marketplace.</p>',
  })

  console.log('Email enviado com sucesso:', info.messageId)
}

main().catch((error) => {
  console.error('❌ Erro ao enviar email:', error)
})