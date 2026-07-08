import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTaskChecklistItemDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}
