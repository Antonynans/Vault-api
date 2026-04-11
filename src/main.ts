import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['log', 'warn', 'error', 'debug'],
  });

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

  if (isDev) {
    const config = new DocumentBuilder()
      .setTitle('Fintech API')
      .setDescription(
        'Core banking — auth, accounts, wallets, transactions, KYC, webhooks',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Auth', 'Register, login, refresh, logout')
      .addTag('Users', 'Profile and user management')
      .addTag('Accounts', 'Multi-currency bank accounts')
      .addTag('Transactions', 'Transfers, deposits, withdrawals')
      .addTag('Wallets', 'Tier-based spending limits')
      .addTag('KYC', 'Know Your Customer verification')
      .addTag('Beneficiaries', 'Saved payees for quick transfers')
      .addTag('Transaction PIN', 'PIN setup and verification')
      .addTag('Fees', 'Dynamic fee configuration (Admin)')
      .addTag('Notifications', 'In-app notifications')
      .addTag('Statements', 'Account statement CSV export')
      .addTag('Webhooks', 'Paystack & Flutterwave inbound events')
      .addTag('Admin', 'Dashboard statistics')
      .addTag('Health', 'Liveness and readiness probes')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
      customSiteTitle: 'Fintech API Docs',
    });

    console.log(`📖  Swagger docs  → http://localhost:${port}/api/docs`);
  }

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`\n🚀  vault API   → http://localhost:${port}/api`);
  console.log(`📦  Environment   → ${configService.get('nodeEnv')}\n`);
}
bootstrap();
