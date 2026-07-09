import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // @Post()
  // create(@Body() createUserDto: CreateUserDto) {
  //   return this.usersService.create(createUserDto);
  // }

  @ApiOperation({ summary: 'Danh sách tất cả tài khoản' })
  @Get()
  findAll(@CurrentUser('sub') userId: string) {
    return this.usersService.findAll(userId);
  }

  @ApiOperation({ summary: 'Tìm user để thêm vào dự án' })
  @Get('candidates')
  findCandidates(
    @Query('search') search: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.usersService.findCandidates(search, userId);
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.usersService.findOne(id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
  //   return this.usersService.update(id, updateUserDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.usersService.remove(id);
  // }
}
