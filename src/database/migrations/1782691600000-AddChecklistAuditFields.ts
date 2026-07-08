import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChecklistAuditFields1782691600000
  implements MigrationInterface
{
  name = 'AddChecklistAuditFields1782691600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_checklist_items"
      ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "task_checklist_items"
      ADD COLUMN IF NOT EXISTS "completed_by" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "task_checklist_items"
      ADD COLUMN IF NOT EXISTS "updated_by" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_checklist_items" DROP COLUMN IF EXISTS "updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_checklist_items" DROP COLUMN IF EXISTS "completed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_checklist_items" DROP COLUMN IF EXISTS "completed_at"`,
    );
  }
}
