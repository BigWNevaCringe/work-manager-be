import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRoleEnum } from './entities/user.entity';
import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    // Check trùng email hoặc username
    const existing = await this.userRepository.findOne({
      where: [{ email: createUserDto.email }, { name: createUserDto.name }],
    });
    if (existing) throw new ConflictException('Email hoặc username đã tồn tại');

    const hashed = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      ...createUserDto,
      password: hashed,
    });

    await this.userRepository.save(user);

    return {
      statusCode: 201,
      message: 'Tạo tài khoản thành công',
    };
  }

  async findAll(currentUserId: string) {
    const currentUser = await this.findOne(currentUserId);
    if (currentUser.role !== UserRoleEnum.ADMIN) {
      throw new ForbiddenException('Chỉ admin được xem toàn bộ tài khoản');
    }

    return await this.userRepository.find();
  }

  async findOne(user_id: string) {
    const user = await this.userRepository.findOne({ where: { user_id } });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    return user;
  }

  async findByEmailWithPassword(email: string) {
    return this.userRepository.findOne({
      where: { email },
      select: {
        user_id: true,
        email: true,
        password: true,
      },
    });
  }

  async upsertGoogleUser(profile: {
    email: string;
    name: string;
    avatar_url?: string | null;
  }) {
    const existingUser = await this.userRepository.findOne({
      where: { email: profile.email },
    });

    if (existingUser) {
      existingUser.name = existingUser.name || profile.name;
      if (profile.avatar_url) existingUser.avatar_url = profile.avatar_url;
      return this.userRepository.save(existingUser);
    }

    const user = this.userRepository.create({
      email: profile.email,
      name: profile.name,
      avatar_url: profile.avatar_url ?? undefined,
      password: null,
    });

    return this.userRepository.save(user);
  }

  update(user_id: string, updateUserDto: UpdateUserDto) {
    void updateUserDto;
    return `This action updates a #${user_id} user`;
  }

  remove(user_id: string) {
    return `This action removes a #${user_id} user`;
  }
}
