import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { StatusEnum } from '../entities/project.entity';

export class ReorderProjectsDto {
  @ApiProperty({ enum: StatusEnum })
  @IsEnum(StatusEnum)
  status!: StatusEnum;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  project_ids!: string[];
}
