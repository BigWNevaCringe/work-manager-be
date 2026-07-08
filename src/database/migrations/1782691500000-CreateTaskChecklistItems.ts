import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskChecklistItems1782691500000
  implements MigrationInterface
{
  name = 'CreateTaskChecklistItems1782691500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "task_checklist_items" (
        "checklist_item_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "completed" boolean NOT NULL DEFAULT false,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "completed_by" character varying,
        "position" double precision NOT NULL DEFAULT '0',
        "created_by" character varying NOT NULL,
        "updated_by" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_checklist_items" PRIMARY KEY ("checklist_item_id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "task_checklist_items"
      ADD CONSTRAINT "FK_task_checklist_items_task"
      FOREIGN KEY ("task_id") REFERENCES "task"("task_id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_task_checklist_items_task_id" ON "task_checklist_items" ("task_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_task_checklist_items_task_id"`);
    await queryRunner.query(
      `ALTER TABLE "task_checklist_items" DROP CONSTRAINT "FK_task_checklist_items_task"`,
    );
    await queryRunner.query(`DROP TABLE "task_checklist_items"`);
  }
}
