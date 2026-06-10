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
import { StringValue } from 'ms';

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
    const match = await bcrypt.compare(loginDTO.password, user.password);
    if (!match) throw new UnauthorizedException('Sai email hoặc mật khẩu');

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
