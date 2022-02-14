import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Server } from 'http';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false, // Strip unexpected properties from objects
      forbidNonWhitelisted: false, // Throw an error when a non whitelisted param is found
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('MyINS')
    .setDescription('The MyINS API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const server: Server = await app.listen(3000);
  server.keepAliveTimeout = 120 * 1000;
  server.headersTimeout = 125 * 1000;
}
bootstrap();
