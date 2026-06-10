import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskUserDto } from './dto/assign-task-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { Project, StatusEnum } from '../projects/entities/project.entity';
import { ProjectMember } from '../project-members/project-member.entity';
import { TaskAssignee } from '../task-assignees/task-assignee.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    @InjectRepository(TaskAssignee)
    private readonly taskAssigneeRepository: Repository<TaskAssignee>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    projectId: string,
    createTaskDto: CreateTaskDto,
    userId: string,
  ) {
    await this.ensureUserCanAccessProject(projectId, userId);

    if (createTaskDto.parent_task_id) {
      await this.ensureParentTaskInProject(
        createTaskDto.parent_task_id,
        projectId,
      );
    }

    const position = await this.getNextPosition(
      projectId,
      createTaskDto.parent_task_id,
    );

    const task = this.taskRepository.create({
      title: createTaskDto.title,
      description: createTaskDto.description,
      parent_task_id: createTaskDto.parent_task_id,
      project_id: projectId,
      created_by: userId,
      position,
    });

    return this.taskRepository.save(task);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string) {
    const task = await this.findTaskOrFail(id);

    await this.ensureUserCanAccessProject(task.project_id, userId);

    if (updateTaskDto.title !== undefined) {
      task.title = updateTaskDto.title;
    }

    if (updateTaskDto.description !== undefined) {
      task.description = updateTaskDto.description;
    }

    return this.taskRepository.save(task);
  }

  async remove(id: string, userId: string) {
    const task = await this.findTaskOrFail(id);

    await this.ensureUserCanAccessProject(task.project_id, userId);
    await this.deleteTaskWithSubtasks(id);

    return {
      message: 'Task đã được xóa',
      task_id: id,
    };
  }

  async assignUser(
    taskId: string,
    assignTaskUserDto: AssignTaskUserDto,
    userId: string,
  ) {
    const task = await this.findTaskOrFail(taskId);

    await this.ensureProjectOwner(task.project_id, userId);
    await this.ensureUserExists(assignTaskUserDto.user_id);
    await this.ensureUserIsProjectMember(
      task.project_id,
      assignTaskUserDto.user_id,
    );

    const existingAssignee = await this.taskAssigneeRepository.findOne({
      where: {
        task_id: taskId,
        user_id: assignTaskUserDto.user_id,
      },
    });

    if (existingAssignee) {
      throw new ConflictException('User đã được phân công vào task này');
    }

    const assignee = this.taskAssigneeRepository.create({
      task_id: taskId,
      user_id: assignTaskUserDto.user_id,
    });

    await this.taskAssigneeRepository.save(assignee);

    return {
      message: 'Đã phân công user vào task',
      task_id: taskId,
      user_id: assignTaskUserDto.user_id,
    };
  }

  async unassignUser(taskId: string, assigneeUserId: string, userId: string) {
    const task = await this.findTaskOrFail(taskId);

    await this.ensureProjectOwner(task.project_id, userId);

    const assignee = await this.taskAssigneeRepository.findOne({
      where: {
        task_id: taskId,
        user_id: assigneeUserId,
      },
    });

    if (!assignee) {
      throw new NotFoundException('User chưa được phân công vào task này');
    }

    await this.taskAssigneeRepository.delete({
      task_id: taskId,
      user_id: assigneeUserId,
    });

    return {
      message: 'Đã gỡ user khỏi task',
      task_id: taskId,
      user_id: assigneeUserId,
    };
  }

  private async ensureUserCanAccessProject(projectId: string, userId: string) {
    const project = await this.projectRepository.findOne({
      where: {
        project_id: projectId,
        status: StatusEnum.ACTIVE,
      },
    });

    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án');
    }

    const member = await this.projectMemberRepository.findOne({
      where: {
        project_id: projectId,
        user_id: userId,
      },
    });

    if (!member) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trong dự án này',
      );
    }
  }

  private async ensureProjectOwner(projectId: string, userId: string) {
    const project = await this.projectRepository.findOne({
      where: {
        project_id: projectId,
        status: StatusEnum.ACTIVE,
      },
    });

    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án');
    }

    if (project.owner_id !== userId) {
      throw new ForbiddenException('Chỉ owner mới được thao tác');
    }
  }

  private async ensureUserExists(userId: string) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy user');
    }
  }

  private async ensureUserIsProjectMember(projectId: string, userId: string) {
    const member = await this.projectMemberRepository.findOne({
      where: {
        project_id: projectId,
        user_id: userId,
      },
    });

    if (!member) {
      throw new BadRequestException(
        'User phải là thành viên của dự án trước khi được phân công task',
      );
    }
  }

  private async ensureParentTaskInProject(
    parentTaskId: string,
    projectId: string,
  ) {
    const parentTask = await this.taskRepository.findOne({
      where: {
        task_id: parentTaskId,
        project_id: projectId,
      },
    });

    if (!parentTask) {
      throw new BadRequestException('Task cha không thuộc dự án này');
    }

    if (parentTask.parent_task_id) {
      throw new BadRequestException('Chỉ task tổng mới được có subtask');
    }
  }

  private async getNextPosition(projectId: string, parentTaskId?: string) {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .select('COALESCE(MAX(task.position), 0)', 'max')
      .where('task.project_id = :projectId', { projectId });

    if (parentTaskId) {
      query.andWhere('task.parent_task_id = :parentTaskId', { parentTaskId });
    } else {
      query.andWhere('task.parent_task_id IS NULL');
    }

    const result = await query.getRawOne<{ max: string | number }>();
    return Number(result?.max ?? 0) + 1;
  }

  private async findTaskOrFail(taskId: string) {
    const task = await this.taskRepository.findOne({
      where: { task_id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy task');
    }

    return task;
  }

  private async deleteTaskWithSubtasks(taskId: string) {
    const subtasks = await this.taskRepository.find({
      where: { parent_task_id: taskId },
    });

    for (const subtask of subtasks) {
      await this.deleteTaskWithSubtasks(subtask.task_id);
    }

    await this.taskAssigneeRepository.delete({ task_id: taskId });
    await this.taskRepository.delete({ task_id: taskId });
  }
}
