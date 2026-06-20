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
import { RemoveTaskAssigneesDto } from './dto/remove-task-assignees.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { Project, StatusEnum } from '../projects/entities/project.entity';
import {
  MemberRoleEnum,
  ProjectMember,
} from '../project-members/project-member.entity';
import { TaskAssignee } from '../task-assignees/task-assignee.entity';
import { User, UserRoleEnum } from '../users/entities/user.entity';

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
    await this.ensureCanManageProject(projectId, userId);

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

    const membership = await this.getActiveProjectMembership(
      task.project_id,
      userId,
    );
    const canManage = this.isManager(membership.role);

    if (
      !canManage &&
      (updateTaskDto.title !== undefined ||
        updateTaskDto.description !== undefined ||
        updateTaskDto.priority !== undefined)
    ) {
      throw new ForbiddenException(
        'Chỉ owner hoặc manager được sửa thông tin task',
      );
    }

    const isAssignee = await this.isTaskAssignee(task.task_id, userId);

    if (updateTaskDto.progress !== undefined) {
      if (!isAssignee) {
        throw new ForbiddenException('Chỉ assignee được cập nhật tiến độ');
      }
      if (![TaskStatus.PROGRESS, TaskStatus.REJECT].includes(task.status)) {
        throw new BadRequestException(
          'Chỉ cập nhật tiến độ khi task đang thực hiện hoặc bị reject',
        );
      }
      if (updateTaskDto.progress < 1 || updateTaskDto.progress > 100) {
        throw new BadRequestException('Tiến độ phải từ 1 đến 100');
      }
    }

    if (
      updateTaskDto.status !== undefined &&
      updateTaskDto.status !== task.status
    ) {
      this.validateStatusTransition(
        task.status,
        updateTaskDto.status,
        canManage,
        isAssignee,
      );
      if (updateTaskDto.status === TaskStatus.TODO) task.progress = 0;
      if (updateTaskDto.status === TaskStatus.DONE) task.progress = 100;
    }

    Object.assign(task, updateTaskDto);
    if (task.status === TaskStatus.TODO) task.progress = 0;
    if (task.status === TaskStatus.DONE) task.progress = 100;

    return this.taskRepository.save(task);
  }

  async reorder(
    projectId: string,
    reorderTasksDto: ReorderTasksDto,
    userId: string,
  ) {
    await this.ensureCanManageProject(projectId, userId);

    const tasks = await this.taskRepository.find({
      where: reorderTasksDto.parent_task_id
        ? {
            project_id: projectId,
            parent_task_id: reorderTasksDto.parent_task_id,
          }
        : { project_id: projectId },
    });
    const siblings = tasks.filter(
      (task) =>
        (task.parent_task_id ?? null) ===
        (reorderTasksDto.parent_task_id ?? null),
    );
    const siblingIds = new Set(siblings.map((task) => task.task_id));

    if (
      siblings.length !== reorderTasksDto.task_ids.length ||
      reorderTasksDto.task_ids.some((taskId) => !siblingIds.has(taskId))
    ) {
      throw new BadRequestException(
        'Danh sách sắp xếp phải chứa đầy đủ task cùng cấp',
      );
    }

    const tasksById = new Map(siblings.map((task) => [task.task_id, task]));
    const reorderedTasks = reorderTasksDto.task_ids.map((taskId, index) => {
      const task = tasksById.get(taskId)!;
      task.position = index + 1;
      return task;
    });

    await this.taskRepository.save(reorderedTasks);

    return {
      message: 'Đã cập nhật thứ tự task',
      project_id: projectId,
      parent_task_id: reorderTasksDto.parent_task_id ?? null,
      task_ids: reorderTasksDto.task_ids,
    };
  }

  async remove(id: string, userId: string) {
    const task = await this.findTaskOrFail(id);

    await this.ensureCanManageProject(task.project_id, userId);
    await this.deleteTaskWithSubtasks(id);

    return {
      message: 'Task đã được xóa',
      task_id: id,
    };
  }

  async assignUsers(
    taskId: string,
    assignTaskUserDto: AssignTaskUserDto,
    userId: string,
  ) {
    const task = await this.findTaskOrFail(taskId);
    const userIds = assignTaskUserDto.user_ids;

    await this.ensureCanManageProject(task.project_id, userId);
    await this.ensureUsersExist(userIds);
    await this.ensureUsersAreProjectMembers(task.project_id, userIds);

    const existingAssignees = await this.taskAssigneeRepository.find({
      where: {
        task_id: taskId,
        user_id: In(userIds),
      },
    });
    const existingAssigneeIds = existingAssignees.map(
      (assignee) => assignee.user_id,
    );

    if (existingAssigneeIds.length > 0) {
      throw new ConflictException({
        message: 'User đã được phân công vào task này',
        user_ids: existingAssigneeIds,
      });
    }

    const assignees = this.taskAssigneeRepository.create(
      userIds.map((assigneeUserId) => ({
        task_id: taskId,
        user_id: assigneeUserId,
      })),
    );

    await this.taskAssigneeRepository.save(assignees);

    return {
      message: 'Đã phân công user vào task',
      task_id: taskId,
      user_ids: userIds,
    };
  }

  async assignUser(
    taskId: string,
    assignTaskUserDto: AssignTaskUserDto,
    userId: string,
  ) {
    return this.assignUsers(taskId, assignTaskUserDto, userId);
  }

  async unassignUsers(
    taskId: string,
    removeTaskAssigneesDto: RemoveTaskAssigneesDto,
    userId: string,
  ) {
    const task = await this.findTaskOrFail(taskId);
    const userIds = removeTaskAssigneesDto.user_ids;

    await this.ensureCanManageProject(task.project_id, userId);

    const assignees = await this.taskAssigneeRepository.find({
      where: {
        task_id: taskId,
        user_id: In(userIds),
      },
    });
    const existingAssigneeIds = new Set(
      assignees.map((assignee) => assignee.user_id),
    );
    const missingAssigneeIds = userIds.filter(
      (id) => !existingAssigneeIds.has(id),
    );

    if (missingAssigneeIds.length > 0) {
      throw new NotFoundException({
        message: 'User chưa được phân công vào task này',
        user_ids: missingAssigneeIds,
      });
    }

    await this.taskAssigneeRepository.delete({
      task_id: taskId,
      user_id: In(userIds),
    });

    return {
      message: 'Đã gỡ user khỏi task',
      task_id: taskId,
      user_ids: userIds,
    };
  }

  async unassignUser(taskId: string, assigneeUserId: string, userId: string) {
    return this.unassignUsers(taskId, { user_ids: [assigneeUserId] }, userId);
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

  private async getActiveProjectMembership(projectId: string, userId: string) {
    if (await this.isSystemAdmin(userId)) {
      const project = await this.projectRepository.findOne({
        where: { project_id: projectId, status: StatusEnum.ACTIVE },
      });
      if (!project) throw new NotFoundException('Không tìm thấy dự án');

      return {
        project_id: projectId,
        user_id: userId,
        role: MemberRoleEnum.OWNER,
      } as ProjectMember;
    }

    await this.ensureUserCanAccessProject(projectId, userId);
    return (await this.projectMemberRepository.findOne({
      where: { project_id: projectId, user_id: userId },
    }))!;
  }

  private async ensureCanManageProject(projectId: string, userId: string) {
    const membership = await this.getActiveProjectMembership(projectId, userId);
    if (!this.isManager(membership.role)) {
      throw new ForbiddenException('Chỉ owner hoặc manager được thao tác');
    }
    return membership;
  }

  private isManager(role: MemberRoleEnum) {
    return role === MemberRoleEnum.OWNER || role === MemberRoleEnum.MANAGER;
  }

  private async isSystemAdmin(userId: string) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });
    return user?.role === UserRoleEnum.ADMIN;
  }

  private async isTaskAssignee(taskId: string, userId: string) {
    return Boolean(
      await this.taskAssigneeRepository.findOne({
        where: { task_id: taskId, user_id: userId },
      }),
    );
  }

  private validateStatusTransition(
    current: TaskStatus,
    next: TaskStatus,
    canManage: boolean,
    isAssignee: boolean,
  ) {
    const memberStatuses = [
      TaskStatus.TODO,
      TaskStatus.PROGRESS,
      TaskStatus.SUBMITTED,
    ];

    const managerTransitions: Partial<Record<TaskStatus, TaskStatus[]>> = {
      [TaskStatus.TODO]: [TaskStatus.PROGRESS],
      [TaskStatus.PROGRESS]: [TaskStatus.TODO, TaskStatus.SUBMITTED],
      [TaskStatus.SUBMITTED]: [
        TaskStatus.PROGRESS,
        TaskStatus.REVIEW,
        TaskStatus.REJECT,
      ],
      [TaskStatus.REVIEW]: [TaskStatus.REJECT, TaskStatus.DONE],
      [TaskStatus.REJECT]: [TaskStatus.PROGRESS, TaskStatus.SUBMITTED],
      [TaskStatus.DONE]: [TaskStatus.REVIEW],
    };

    if (canManage && managerTransitions[current]?.includes(next)) return;
    if (
      isAssignee &&
      memberStatuses.includes(current) &&
      memberStatuses.includes(next)
    ) {
      return;
    }
    if (
      isAssignee &&
      current === TaskStatus.REJECT &&
      [TaskStatus.TODO, TaskStatus.PROGRESS].includes(next)
    ) {
      return;
    }

    throw new ForbiddenException('Bạn không có quyền chuyển trạng thái này');
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

  private async ensureUsersExist(userIds: string[]) {
    const users = await this.userRepository.find({
      where: { user_id: In(userIds) },
    });
    const existingUserIds = new Set(users.map((user) => user.user_id));
    const missingUserIds = userIds.filter((id) => !existingUserIds.has(id));

    if (missingUserIds.length > 0) {
      throw new NotFoundException({
        message: 'Không tìm thấy user',
        user_ids: missingUserIds,
      });
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

  private async ensureUsersAreProjectMembers(
    projectId: string,
    userIds: string[],
  ) {
    const members = await this.projectMemberRepository.find({
      where: {
        project_id: projectId,
        user_id: In(userIds),
      },
    });
    const memberIds = new Set(members.map((member) => member.user_id));
    const nonMemberIds = userIds.filter((id) => !memberIds.has(id));

    if (nonMemberIds.length > 0) {
      throw new BadRequestException({
        message:
          'User phải là thành viên của dự án trước khi được phân công task',
        user_ids: nonMemberIds,
      });
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

  private async checkExistingName(
    title: string,
    userId: string,
    excludeProjectId?: string,
  ) {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .innerJoin('project.members', 'member')
      .where('member.user_id = :userId', { userId })
      .andWhere('project.project_name = :project_name', { title })
      .andWhere('project.status = :status', { status: StatusEnum.ACTIVE });

    if (excludeProjectId) {
      query.andWhere('project.project_id != :excludeProjectId', {
        excludeProjectId,
      });
    }

    const existing = await query.getOne();

    if (existing) {
      throw new ConflictException('Tên dự án đã tồn tại');
    }
  }
}
