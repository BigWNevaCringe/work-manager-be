import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'I finished the first draft.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  task_id?: string | null;
}
