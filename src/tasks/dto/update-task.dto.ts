import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
