import 'dotenv/config';
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // validação global (padrão profissional)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS para o Next
  app.enableCors({
    origin: ["http://localhost:3000", "http://localhost:3002"],
    credentials: true,
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle("Feira Gastronômica API")
    .setDescription("API do sistema da feira gastronômica")
    .setVersion("1.0.0")
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);

  const baseUrl = `http://localhost:${port}`;
  console.log(`✅ API rodando em: ${baseUrl}`);
  console.log(`📚 Swagger em: ${baseUrl}/docs`);
  console.log(`🩺 Health em: ${baseUrl}/health`);
}
bootstrap();
