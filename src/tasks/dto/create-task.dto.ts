import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Design dashboard layout' })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề task không được để trống' })
  title!: string;

  @ApiProperty({ example: 'Create the main dashboard layout and widgets' })
  @IsString()
  @IsNotEmpty({ message: 'Mô tả task không được để trống' })
  description!: string;

  @ApiPropertyOptional({
    example: '8cefb3f4-ff70-4720-9ad2-7a052f5550c2',
  })
  @IsOptional()
  @IsUUID()
  parent_task_id?: string;
}
