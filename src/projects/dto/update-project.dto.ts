import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ProjectPriorityEnum } from '../entities/project.entity';

export class UpdateProjectDto {
  @ApiProperty({ example: 'Pipilabu Manager' })
  @IsString()
  @IsNotEmpty({ message: 'Tên dự án không được để trống' })
  project_name!: string;

  @ApiProperty({ example: 'Manage and catch your pipilabu in 4k' })
  @IsNotEmpty({ message: 'Mô tả không được để trống' })
  @IsString()
  project_description!: string;

  @ApiProperty({ example: '2026-07-04T00:00:00.000Z' })
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  start_date!: string;

  @ApiProperty({ example: '2026-08-04T00:00:00.000Z' })
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  end_date!: string;

  @ApiProperty({ enum: ProjectPriorityEnum, example: ProjectPriorityEnum.MEDIUM })
  @IsEnum(ProjectPriorityEnum, { message: 'Độ ưu tiên dự án không hợp lệ' })
  priority!: ProjectPriorityEnum;
}
