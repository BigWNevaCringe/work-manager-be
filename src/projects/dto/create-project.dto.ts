import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Pipilabu Manager' })
  @IsString()
  @IsNotEmpty({ message: 'Tên dự án không được để trống' })
  project_name!: string;

  @ApiProperty({ example: 'Manage your pipilabu in 4k' })
  @IsNotEmpty({ message: 'Mô tả không được để trống' })
  @IsString()
  project_description!: string;
}
