import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1782691300000 implements MigrationInterface {
  name = 'CreateNotifications1782691300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('task_assigned', 'task_rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("notification_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "project_id" uuid NOT NULL, "task_id" uuid, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying NOT NULL, "message" text NOT NULL, "metadata" jsonb, "seen_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_notifications_notification_id" PRIMARY KEY ("notification_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_project_seen" ON "notifications" ("user_id", "project_id", "seen_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_project_seen"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
  }
}
