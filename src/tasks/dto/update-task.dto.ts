import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TaskPriorityEnum, TaskStatus } from '../entities/task.entity';

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Update dashboard layout' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề task không được để trống' })
  title?: string;

  @ApiPropertyOptional({ example: 'Update dashboard layout and widgets' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Mô tả task không được để trống' })
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, example: TaskStatus.PROGRESS })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    example: 'Thiếu ảnh nghiệm thu ở phần bàn giao',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  rejection_reason?: string | null;

  @ApiPropertyOptional({
    enum: TaskPriorityEnum,
    example: TaskPriorityEnum.HIGH,
  })
  @IsOptional()
  @IsEnum(TaskPriorityEnum)
  priority?: TaskPriorityEnum;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional({ example: '2026-06-21T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @ApiPropertyOptional({ example: '2026-06-30T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  due_date?: string | null;
}
