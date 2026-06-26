import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  HttpCode,
  UseGuards,
  Headers,
  UnauthorizedException,
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

  private setAuthCookies(
    res: Response,
    tokens: { access_token: string; refresh_token: string },
  ) {
    const secure = process.env.NODE_ENV === 'production';
    const accessTokenMaxAge = ms(
      this.configService.getOrThrow<StringValue>('JWT_EXPIRATION_TIME'),
    );
    const refreshTokenMaxAge = ms(
      this.configService.getOrThrow<StringValue>('JWT_REFRESH_EXPIRATION_TIME'),
    );

    res.cookie('wm_access_token', tokens.access_token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: accessTokenMaxAge,
      path: '/',
    });

    res.cookie('wm_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: refreshTokenMaxAge,
      path: '/',
    });
  }

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
    const tokens = await this.authService.login(dto);
    this.setAuthCookies(res, tokens);

    return {
      message: 'Đăng nhập thành công',
    };
  }

  @ApiOperation({ summary: 'Đăng nhập/đăng ký bằng Google từ Better Auth' })
  @Post('oauth/google')
  @HttpCode(200)
  async loginWithGoogle(
    @Body() dto: { email: string; name: string; avatar_url?: string | null },
    @Headers('x-better-auth-secret') betterAuthSecret: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (
      betterAuthSecret !==
      this.configService.getOrThrow<string>('BETTER_AUTH_BACKEND_SECRET')
    ) {
      throw new UnauthorizedException();
    }

    const tokens = await this.authService.loginWithGoogle(dto);
    this.setAuthCookies(res, tokens);

    return { message: 'Đăng nhập Google thành công' };
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

    res.clearCookie('wm_access_token', cookieOptions);
    res.clearCookie('wm_refresh_token', cookieOptions);

    return { message: 'Đăng xuất thành công' };
  }

  @ApiOperation({
    summary: 'Kiểm tra tài khoản - trả về thông tin user đăng nhập',
  })
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Get('user')
  async getMe(@CurrentUser('sub') userId: string) {
    return this.authService.me(userId);
  }
}
