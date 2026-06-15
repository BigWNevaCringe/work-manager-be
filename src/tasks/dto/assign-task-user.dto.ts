import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignTaskUserDto {
  @ApiProperty({
    example: ['6132352f-013f-4fe6-bb6f-7b785497fbef'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  user_ids!: string[];
}
