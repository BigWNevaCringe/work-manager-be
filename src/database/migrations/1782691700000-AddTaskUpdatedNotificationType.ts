import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskUpdatedNotificationType1782691700000
  implements MigrationInterface
{
  name = 'AddTaskUpdatedNotificationType1782691700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'task_updated'`,
    );
  }

  public async down(): Promise<void> {}
}
