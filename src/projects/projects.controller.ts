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
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';
import { ReorderProjectsDto } from './dto/reorder-projects.dto';
import { UpdateProjectMemberRoleDto } from './dto/update-project-member-role.dto';
import { Query } from '@nestjs/common';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { RemoveProjectMembersDto } from './dto/remove-project-members.dto';
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

  @ApiOperation({ summary: 'Tìm user có thể thêm vào project - chỉ owner' })
  @Get(':id/member-candidates')
  findMemberCandidates(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('search') search: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.findMemberCandidates(id, search, userId);
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
    summary: 'Thêm nhiều user vào project - chỉ owner được thao tác',
    description: 'Truyền project_id trên url và body payload với user_id',
  })
  @Post(':id/members')
  addMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addProjectMemberDto: AddProjectMemberDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.addMembers(id, addProjectMemberDto, userId);
  }

  @ApiOperation({
    summary: 'Xóa nhiều user khỏi project - chỉ owner được thao tác',
    description: 'Truyền project_id trên url và body payload với user_id',
  })
  @Delete(':id/members')
  removeMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() removeProjectMembersDto: RemoveProjectMembersDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.removeMembers(
      id,
      removeProjectMembersDto,
      userId,
    );
  }

  @ApiOperation({ summary: 'Phân quyền manager/member - chỉ owner' })
  @Patch(':id/members/:memberId/role')
  updateMemberRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateProjectMemberRoleDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.updateMemberRole(id, memberId, dto, userId);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin dự án' })
  @Patch('reorder')
  reorder(
    @Body() reorderProjectsDto: ReorderProjectsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.reorder(reorderProjectsDto, userId);
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

  @ApiOperation({ summary: 'Cập nhật trạng thái dự án' })
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectStatusDto: UpdateProjectStatusDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.updateStatus(
      id,
      updateProjectStatusDto,
      userId,
    );
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

  @ApiOperation({ summary: 'Xóa vĩnh viễn một dự án đã archived' })
  @Delete(':id/permanent')
  permanentlyRemove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.permanentlyRemove(id, userId);
  }
}
