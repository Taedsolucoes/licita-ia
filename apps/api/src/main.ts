import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api', {
    exclude: ['health', 'ready'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN;
  if (process.env.NODE_ENV === 'production' && (!corsOrigin || corsOrigin === '*')) {
    console.error(
      'SECURITY WARNING: CORS_ORIGIN is not set (or is "*") while NODE_ENV=production. ' +
        'Set CORS_ORIGIN to an explicit domain (e.g. https://app.licitaia.com.br) before commercial launch.',
    );
  }

  app.enableCors({
    origin: corsOrigin && corsOrigin !== '*' ? corsOrigin.split(',').map((o) => o.trim()) : '*',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Licita IA API running on port ${port}`);
}

bootstrap();
