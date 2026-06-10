import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
    @ApiProperty({ example: "user@gmail.com" })
    @IsEmail({}, {message: 'Email không hợp lệ'})
    @IsNotEmpty({ message: 'Email không được để trống' })
    email!: string
    
    @ApiProperty({ example: "password" })
    @IsString()
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    password!: string
}

export class RegisterDto {
    @ApiProperty({ example: "username" })
    @IsString()
    @IsNotEmpty()
    name!: string

    @ApiProperty({ example: "user@gmail.com" })
    @IsEmail({}, {message: 'Email không hợp lệ'})
    @IsNotEmpty({ message: 'Email không được để trống' })
    email!: string
    
    @ApiProperty({ example: "password" })
    @IsString()
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    password!: string
}