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
import { RemoveTaskAssigneesDto } from './dto/remove-task-assignees.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
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
    summary: 'Phân công nhiều user vào task - chỉ owner project được thao tác',
  })
  @Post(':id/assignees')
  assignUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignTaskUserDto: AssignTaskUserDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.tasksService.assignUsers(id, assignTaskUserDto, userId);
  }

  @ApiOperation({
    summary: 'Gỡ nhiều user khỏi task - chỉ owner project được thao tác',
  })
  @Delete(':id/assignees')
  unassignUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() removeTaskAssigneesDto: RemoveTaskAssigneesDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.tasksService.unassignUsers(id, removeTaskAssigneesDto, userId);
  }

  @ApiOperation({
    summary: 'Cập nhật thông tin task - dựa vào task_id',
    description:
      'Nếu cập nhật subtask thì truyền thêm "parent_task_id" là "task_id" của task cha còn không thì không truyền',
  })
  @Patch('project/:id/reorder')
  reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reorderTasksDto: ReorderTasksDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.tasksService.reorder(id, reorderTasksDto, userId);
  }

  @ApiOperation({
    summary: 'Cập nhật thông tin, trạng thái, độ ưu tiên và tiến độ task',
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
