import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskUserDto } from './dto/assign-task-user.dto';
import { ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(AuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiOperation({
    summary: 'Thêm task mới cho dự án - dựa vào project_id',
    description:
      'Nếu tạo subtask thì truyền thêm "parent_task_id" là "task_id" của task cha còn không thì không truyền',
  })
  @Post(':id')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.tasksService.create(id, createTaskDto, userId);
  }

  @ApiOperation({
    summary: 'Phân công user vào task - chỉ owner project được thao tác',
  })
  @Post('assign-user/:id')
  assignUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignTaskUserDto: AssignTaskUserDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.tasksService.assignUser(id, assignTaskUserDto, userId);
  }

  @ApiOperation({
    summary: 'Gỡ user khỏi task - chỉ owner project được thao tác',
    description: '/remove-user-from-task/{task_id}/{user_id}'
  })
  @Delete('/remove-user-from-task/:id/:userId')
  unassignUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) assigneeUserId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.tasksService.unassignUser(id, assigneeUserId, userId);
  }

  @ApiOperation({
    summary: 'Cập nhật thông tin task - dựa vào task_id',
    description:
      'Nếu cập nhật subtask thì truyền thêm "parent_task_id" là "task_id" của task cha còn không thì không truyền',
  })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.tasksService.update(id, updateTaskDto, userId);
  }

  @ApiOperation({
    summary: 'Xóa task khỏi dự án - dựa vào task_id',
  })
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.tasksService.remove(id, userId);
  }
}
