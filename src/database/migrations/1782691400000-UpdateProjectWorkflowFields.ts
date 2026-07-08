import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateProjectWorkflowFields1782691400000
  implements MigrationInterface
{
  name = 'UpdateProjectWorkflowFields1782691400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "public"."project_status_enum" RENAME TO "project_status_enum_old"',
    );
    await queryRunner.query(
      'CREATE TYPE "public"."project_status_enum" AS ENUM(\'new\', \'in_progress\', \'paused\', \'completed\', \'canceled\')',
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "status" TYPE "public"."project_status_enum" USING (
        CASE
          WHEN "status"::text = 'active' THEN 'in_progress'
          WHEN "status"::text = 'archived' THEN 'canceled'
          ELSE "status"::text
        END
      )::"public"."project_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "status" SET DEFAULT 'new'`,
    );
    await queryRunner.query('DROP TYPE "public"."project_status_enum_old"');
    await queryRunner.query(
      'CREATE TYPE "public"."project_priority_enum" AS ENUM(\'highest\', \'high\', \'medium\', \'low\', \'lowest\')',
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD "priority" "public"."project_priority_enum" NOT NULL DEFAULT 'medium'`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD "start_date" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD "end_date" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "project" SET "start_date" = COALESCE("start_date", now()), "end_date" = COALESCE("end_date", now())`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "start_date" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "end_date" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "end_date"`);
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "start_date"`);
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "priority"`);
    await queryRunner.query('DROP TYPE "public"."project_priority_enum"');
    await queryRunner.query(
      'ALTER TYPE "public"."project_status_enum" RENAME TO "project_status_enum_old"',
    );
    await queryRunner.query(
      'CREATE TYPE "public"."project_status_enum" AS ENUM(\'active\', \'archived\', \'completed\')',
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "status" TYPE "public"."project_status_enum" USING (
        CASE
          WHEN "status"::text IN ('new', 'in_progress', 'paused') THEN 'active'
          WHEN "status"::text = 'canceled' THEN 'archived'
          ELSE "status"::text
        END
      )::"public"."project_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query('DROP TYPE "public"."project_status_enum_old"');
  }
}
