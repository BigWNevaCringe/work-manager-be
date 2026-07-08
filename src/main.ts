import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/exception-transform-filter/http-exception.filter';
import { TransformInterceptor } from './common/exception-transform-filter/transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const dataSource = app.get(DataSource);

  await ensureProjectSchemaCompatibility(dataSource);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  app.useGlobalPipes(new ValidationPipe());

  app.setGlobalPrefix('api/v1');

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Work API')
    .setDescription('API documentation cho Work Manager')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // truy cập tại Swagger tại /docs
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // giữ token khi F5 liên tục
    },
  });

  const corsOrigins = configService
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(helmet());

  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port);
  //
}
bootstrap();

async function ensureProjectSchemaCompatibility(dataSource: DataSource) {
  await dataSource.query(`
    ALTER TYPE "public"."project_status_enum" ADD VALUE IF NOT EXISTS 'new'
  `);
  await dataSource.query(`
    ALTER TYPE "public"."project_status_enum" ADD VALUE IF NOT EXISTS 'in_progress'
  `);
  await dataSource.query(`
    ALTER TYPE "public"."project_status_enum" ADD VALUE IF NOT EXISTS 'paused'
  `);
  await dataSource.query(`
    ALTER TYPE "public"."project_status_enum" ADD VALUE IF NOT EXISTS 'canceled'
  `);
  await dataSource.query(`
    DO $$
    BEGIN
      CREATE TYPE "public"."project_priority_enum" AS ENUM (
        'highest',
        'high',
        'medium',
        'low',
        'lowest'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await dataSource.query(`
    ALTER TABLE "project"
    ADD COLUMN IF NOT EXISTS "priority" "public"."project_priority_enum" DEFAULT 'medium'
  `);
  await dataSource.query(`
    ALTER TABLE "project"
    ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMP WITH TIME ZONE DEFAULT now()
  `);
  await dataSource.query(`
    ALTER TABLE "project"
    ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMP WITH TIME ZONE DEFAULT now()
  `);
  await dataSource.query(`
    UPDATE "project"
    SET
      "priority" = COALESCE("priority", 'medium'::"public"."project_priority_enum"),
      "start_date" = COALESCE("start_date", now()),
      "end_date" = COALESCE("end_date", now())
  `);
  await dataSource.query(`
    UPDATE "project"
    SET "status" = 'in_progress'
    WHERE "status"::text = 'active'
  `);
  await dataSource.query(`
    UPDATE "project"
    SET "status" = 'canceled'
    WHERE "status"::text = 'archived'
  `);
  await dataSource.query(`
    ALTER TABLE "project"
    ALTER COLUMN "priority" SET NOT NULL,
    ALTER COLUMN "start_date" SET DEFAULT now(),
    ALTER COLUMN "end_date" SET DEFAULT now()
  `);
  await dataSource.query(`
    ALTER TABLE "project"
    ALTER COLUMN "status" SET DEFAULT 'new'
  `);
}
