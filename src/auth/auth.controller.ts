import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import type { Response } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue } from 'ms';
import { ApiOperation } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Đăng ký tài khoản' })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Đăng nhập tài khoản' })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token } = await this.authService.login(dto);
    const secure = process.env.NODE_ENV === 'production';
    const accessTokenMaxAge = ms(
      this.configService.getOrThrow<StringValue>('JWT_EXPIRATION_TIME'),
    );
    const refreshTokenMaxAge = ms(
      this.configService.getOrThrow<StringValue>('JWT_REFRESH_EXPIRATION_TIME'),
    );

    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: accessTokenMaxAge,
      path: '/',
    });

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: refreshTokenMaxAge,
      path: '/',
    });

    return {
      message: 'Đăng nhập thành công',
      // access_token,
    };
  }

  @ApiOperation({ summary: 'Đăng xuất tài khoản' })
  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  logout(@Res({ passthrough: true }) res: Response) {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };

    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);

    return { message: 'Đăng xuất thành công' };
  }

  @ApiOperation({
    summary: 'Kiểm tra tài khoản - trả về thông tin user đăng nhập',
  })
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Get('me')
  async getMe(@CurrentUser('sub') userId: string) {
    return this.authService.me(userId);
  }
}
