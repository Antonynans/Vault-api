import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;
  const isDev = configService.get<string>('nodeEnv') === 'development';

  app.use(helmet({ contentSecurityPolicy: isDev ? false : undefined }));
  app.enableCors({
    origin: isDev
      ? '*'
      : (configService.get<string>('ALLOWED_ORIGINS') ?? '').split(','),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Correlation-ID',
    ],
    exposedHeaders: ['X-Correlation-ID'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(port);
  console.log(`\n🚀  Fintech API   → http://localhost:${port}/api`);
}
bootstrap();
