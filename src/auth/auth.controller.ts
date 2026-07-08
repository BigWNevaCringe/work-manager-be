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
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import type { Response } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
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
    const cookieOptions = this.authService.getAuthCookieOptions();

    res.cookie('wm_access_token', tokens.access_token, {
      ...cookieOptions.access,
    });

    res.cookie('wm_refresh_token', tokens.refresh_token, {
      ...cookieOptions.refresh,
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

  @ApiOperation({ summary: 'Chuyển hướng đăng nhập Google từ backend' })
  @Get('google')
  loginGoogle(@Res() res: Response) {
    return res.redirect(this.authService.getGoogleAuthorizationUrl());
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @Get('google/callback')
  async loginGoogleCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const appUrl = this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';

    if (error || !code) {
      res.redirect(`${appUrl}/login?error=google`);
      return;
    }

    try {
      const tokens = await this.authService.loginWithGoogleCode(code);
      this.setAuthCookies(res, tokens);
      res.redirect(`${appUrl}/`);
    } catch {
      res.redirect(`${appUrl}/login?error=google`);
    }
  }

  @ApiOperation({ summary: 'Đăng xuất tài khoản' })
  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  logout(@Res({ passthrough: true }) res: Response) {
    const result = this.authService.logout();

    res.clearCookie('wm_access_token', result.cookies);
    res.clearCookie('wm_refresh_token', result.cookies);

    return { message: result.message };
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
