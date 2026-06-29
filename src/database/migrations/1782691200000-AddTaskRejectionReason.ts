import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskRejectionReason1782691200000
  implements MigrationInterface
{
  name = 'AddTaskRejectionReason1782691200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "task" ADD "rejection_reason" text',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "task" DROP COLUMN "rejection_reason"',
    );
  }
}
