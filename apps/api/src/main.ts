import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3002'], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('v1');
  const doc = new DocumentBuilder().setTitle('Lahloba API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  const port = process.env.API_PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log('API on http://localhost:' + port + ' | Docs: /docs');
}
bootstrap();
