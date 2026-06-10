import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiOperation } from '@nestjs/swagger';

@UseGuards(AuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOperation({ summary: 'Tạo dự án' })
  @Post()
  create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.create(createProjectDto, userId);
  }

  @ApiOperation({
    summary: 'Lấy danh sách các dự án đã hoàn thành',
  })
  @Get('completed')
  findCompleted(@CurrentUser('sub') userId: string) {
    return this.projectsService.findCompleted(userId);
  }

  @ApiOperation({
    summary: 'Lấy danh sách các dự án đã xóa tạm thời (archived)',
  })
  @Get('archived')
  findArchived(@CurrentUser('sub') userId: string) {
    return this.projectsService.findArchived(userId);
  }

  @ApiOperation({
    summary: 'Lấy danh sách các dự án đang làm',
  })
  @Get()
  findActive(@CurrentUser('sub') userId: string) {
    return this.projectsService.findActive(userId);
  }

  @ApiOperation({
    summary: 'Lấy thông tin project bằng project_id',
  })
  @Get(':id')
  findOneByProjectId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.findOneByProjectId(id, userId);
  }

  @ApiOperation({
    summary: 'Thêm user vào project - chỉ owner được thao tác',
  })
  @Post(':id/members')
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addProjectMemberDto: AddProjectMemberDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.addMember(id, addProjectMemberDto, userId);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin dự án' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.update(id, updateProjectDto, userId);
  }

  @ApiOperation({
    summary: 'Tạm thời xóa dự án và đưa sang trạng thái archived',
  })
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.remove(id, userId);
  }
}
