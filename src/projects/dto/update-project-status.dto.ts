import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { StatusEnum } from '../entities/project.entity';

export class UpdateProjectStatusDto {
  @ApiProperty({ enum: StatusEnum, example: StatusEnum.COMPLETED })
  @IsEnum(StatusEnum, { message: 'Trạng thái dự án không hợp lệ' })
  status!: StatusEnum;
}
