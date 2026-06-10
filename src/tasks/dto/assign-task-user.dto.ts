import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTaskUserDto {
  @ApiProperty({ example: '6132352f-013f-4fe6-bb6f-7b785497fbef' })
  @IsUUID()
  user_id!: string;
}
