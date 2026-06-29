import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue } from 'ms';

type AuthCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict';
  path: '/';
  maxAge?: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDTO: RegisterDto) {
    return await this.usersService.create(registerDTO);
  }

  async login(loginDTO: LoginDto) {
    // Tìm tài khoản dựa vào email, nếu không có thì throw error
    const user = await this.usersService.findByEmailWithPassword(
      loginDTO.email,
    );
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');

    // Nếu tìm thấy thì đem đi so sánh với mật khẩu trên server với mật khẩu vừa nhập
    if (!user.password) {
      throw new UnauthorizedException(
        'Tài khoản này đang đăng nhập bằng Google',
      );
    }

    const match = await bcrypt.compare(loginDTO.password, user.password);
    if (!match) throw new UnauthorizedException('Sai email hoặc mật khẩu');

    return this.issueTokens({ user_id: user.user_id, email: user.email });
  }

  async loginWithGoogle(profile: {
    email: string;
    name: string;
    avatar_url?: string | null;
  }) {
    const user = await this.usersService.upsertGoogleUser(profile);
    return this.issueTokens({ user_id: user.user_id, email: user.email });
  }

  getAuthCookieOptions() {
    const secure = process.env.NODE_ENV === 'production';
    const baseOptions = {
      httpOnly: true as const,
      secure,
      sameSite: 'strict' as const,
      path: '/' as const,
    };

    return {
      access: {
        ...baseOptions,
        maxAge: ms(
          this.configService.getOrThrow<StringValue>('JWT_EXPIRATION_TIME'),
        ),
      },
      refresh: {
        ...baseOptions,
        maxAge: ms(
          this.configService.getOrThrow<StringValue>(
            'JWT_REFRESH_EXPIRATION_TIME',
          ),
        ),
      },
      clear: baseOptions,
    } satisfies Record<'access' | 'refresh' | 'clear', AuthCookieOptions>;
  }

  logout() {
    return {
      message: 'Đăng xuất thành công',
      cookies: this.getAuthCookieOptions().clear,
    };
  }

  private issueTokens(user: { user_id: string; email: string }) {
    const payload = { sub: user.user_id, email: user.email };
    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<StringValue>('JWT_EXPIRATION_TIME'),
    });

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<StringValue>(
        'JWT_REFRESH_EXPIRATION_TIME',
      ),
    });

    return { access_token, refresh_token };
  }

  async me(id: string) {
    return this.usersService.findOne(id);
  }
}
