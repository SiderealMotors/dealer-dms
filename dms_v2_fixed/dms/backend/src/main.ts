import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow comma-separated origins for multi-domain support (DMS + website)
  const originsEnv = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  const origins = originsEnv.split(',').map(o => o.trim()).filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow no-origin requests (same-origin, mobile apps, Postman)
      if (!origin) return callback(null, true);
      if (origins.includes(origin) || origins.includes('*')) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get("/health", (_req: any, res: any) => res.json({ status: "ok", ts: new Date().toISOString() }));
  console.log(`🚀 DMS API running on port ${port}`);
}

bootstrap();
