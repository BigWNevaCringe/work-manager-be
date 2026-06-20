import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class ReorderTasksDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  task_ids!: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  parent_task_id?: string | null;
}
