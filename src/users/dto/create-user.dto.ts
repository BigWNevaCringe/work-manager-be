import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'username' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'url_image' })
  avatar_url?: string;

  @ApiProperty({ example: 'password' })
  @IsString()
  password!: string;
}
