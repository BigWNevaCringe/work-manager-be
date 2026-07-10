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
import { CreateTaskChecklistItemDto } from './dto/create-task-checklist-item.dto';
import { UpdateTaskChecklistItemDto } from './dto/update-task-checklist-item.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { TaskChecklistItem } from './entities/task-checklist-item.entity';
import { Project, StatusEnum } from '../projects/entities/project.entity';
import {
  MemberRoleEnum,
  ProjectMember,
} from '../project-members/project-member.entity';
import { TaskAssignee } from '../task-assignees/task-assignee.entity';
import { User, UserRoleEnum } from '../users/entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

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
    @InjectRepository(TaskChecklistItem)
    private readonly checklistItemRepository: Repository<TaskChecklistItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    projectId: string,
    createTaskDto: CreateTaskDto,
    userId: string,
  ) {
    if (createTaskDto.parent_task_id) {
      await this.ensureParentTaskInProject(
        createTaskDto.parent_task_id,
        projectId,
      );
      const canManageProject = await this.canManageProject(projectId, userId);
      const isParentAssignee = await this.isTaskAssignee(
        createTaskDto.parent_task_id,
        userId,
      );
      if (!canManageProject && !isParentAssignee) {
        throw new ForbiddenException(
          'Chỉ owner, manager hoặc assignee của task cha được tạo checklist',
        );
      }
    } else {
      await this.ensureCanManageProject(projectId, userId);
    }

    await this.shiftSiblingPositionsDown(
      projectId,
      createTaskDto.parent_task_id,
    );

    this.validateTaskDates(createTaskDto.start_date, createTaskDto.due_date);

    const task = this.taskRepository.create({
      title: createTaskDto.title,
      description: createTaskDto.description,
      parent_task_id: createTaskDto.parent_task_id,
      project_id: projectId,
      created_by: userId,
      position: 1,
      priority: createTaskDto.priority,
      start_date: createTaskDto.start_date
        ? new Date(createTaskDto.start_date)
        : undefined,
      due_date: createTaskDto.due_date
        ? new Date(createTaskDto.due_date)
        : undefined,
    });

    const savedTask = await this.taskRepository.save(task);
    this.realtimeGateway.emitProjectEvent(
      savedTask.project_id,
      'task.created',
      {
        task: savedTask,
      },
    );

    return savedTask;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string) {
    const task = await this.findTaskOrFail(id);

    const membership = await this.getActiveProjectMembership(
      task.project_id,
      userId,
    );
    const canManage = this.isManager(membership.role);
    const isOwner = membership.role === MemberRoleEnum.OWNER;
    const canEditChecklistTask =
      Boolean(task.parent_task_id) &&
      (await this.isTaskAssignee(task.parent_task_id as string, userId));

    if (
      !canManage &&
      !canEditChecklistTask &&
      (updateTaskDto.title !== undefined ||
        updateTaskDto.description !== undefined ||
        updateTaskDto.priority !== undefined ||
        updateTaskDto.start_date !== undefined ||
        updateTaskDto.due_date !== undefined)
    ) {
      throw new ForbiddenException(
        'Chỉ owner, manager hoặc assignee của task cha được sửa checklist',
      );
    }

    const isAssignee = await this.isTaskAssignee(task.task_id, userId);
    const isParentAssignee =
      Boolean(task.parent_task_id) &&
      (await this.isTaskAssignee(task.parent_task_id as string, userId));
    const isOwnerSelfAssignedTask =
      isOwner && (await this.isOnlyTaskAssignee(task.task_id, userId));

    if (
      updateTaskDto.start_date !== undefined ||
      updateTaskDto.due_date !== undefined
    ) {
      const startDate =
        updateTaskDto.start_date === undefined
          ? task.start_date
          : updateTaskDto.start_date;
      const dueDate =
        updateTaskDto.due_date === undefined
          ? task.due_date
          : updateTaskDto.due_date;
      this.validateTaskDates(startDate, dueDate);
    }

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
        canManage || isParentAssignee,
        isAssignee || isParentAssignee,
        isOwnerSelfAssignedTask,
      );
      if (updateTaskDto.status === TaskStatus.TODO) task.progress = 0;
      if (updateTaskDto.status === TaskStatus.DONE) task.progress = 100;
      if (updateTaskDto.status === TaskStatus.REJECT) {
        const reason = updateTaskDto.rejection_reason?.trim();
        if (!reason) {
          throw new BadRequestException('Vui lòng nhập lý do từ chối task');
        }
        task.rejection_reason = reason;
      }
      if (
        task.status === TaskStatus.REJECT &&
        updateTaskDto.status === TaskStatus.PROGRESS
      ) {
        task.rejection_reason = null;
      }
    }

    Object.assign(task, updateTaskDto, {
      ...(updateTaskDto.rejection_reason !== undefined && {
        rejection_reason: updateTaskDto.rejection_reason?.trim() || null,
      }),
      ...(updateTaskDto.start_date !== undefined && {
        start_date: updateTaskDto.start_date
          ? new Date(updateTaskDto.start_date)
          : null,
      }),
      ...(updateTaskDto.due_date !== undefined && {
        due_date: updateTaskDto.due_date
          ? new Date(updateTaskDto.due_date)
          : null,
      }),
    });
    task.progress = await this.calculateTaskProgress(task.task_id, task.status);

    const savedTask = await this.taskRepository.save(task);
    this.realtimeGateway.emitProjectEvent(task.project_id, 'task.updated', {
      task: savedTask,
    });
    if (updateTaskDto.status === TaskStatus.REJECT) {
      const assignees = await this.taskAssigneeRepository.find({
        where: { task_id: savedTask.task_id },
      });
      await this.notificationsService.createMany(
        assignees.map((assignee) => ({
          userId: assignee.user_id,
          projectId: savedTask.project_id,
          taskId: savedTask.task_id,
          type: NotificationType.TASK_REJECTED,
          title: 'Task bị từ chối',
          message: `${savedTask.title}: ${
            savedTask.rejection_reason ?? 'Cần cập nhật lại task'
          }`,
          metadata: { rejection_reason: savedTask.rejection_reason },
        })),
      );
      this.realtimeGateway.emitProjectEvent(task.project_id, 'task.rejected', {
        task: savedTask,
        rejection_reason: savedTask.rejection_reason,
      });
    }

    return savedTask;
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
    this.realtimeGateway.emitProjectEvent(projectId, 'task.reordered', {
      parent_task_id: reorderTasksDto.parent_task_id ?? null,
      task_ids: reorderTasksDto.task_ids,
    });

    return {
      message: 'Đã cập nhật thứ tự task',
      project_id: projectId,
      parent_task_id: reorderTasksDto.parent_task_id ?? null,
      task_ids: reorderTasksDto.task_ids,
    };
  }

  async remove(id: string, userId: string) {
    const task = await this.findTaskOrFail(id);

    const canManageProject = await this.canManageProject(task.project_id, userId);
    const canDeleteChecklistTask =
      Boolean(task.parent_task_id) &&
      (await this.isTaskAssignee(task.parent_task_id as string, userId));
    if (!canManageProject && !canDeleteChecklistTask) {
      throw new ForbiddenException(
        'Chỉ owner, manager hoặc assignee của task cha được xóa checklist',
      );
    }
    await this.deleteTaskWithSubtasks(id);
    this.realtimeGateway.emitProjectEvent(task.project_id, 'task.deleted', {
      task_id: id,
    });

    return {
      message: 'Task đã được xóa',
      task_id: id,
    };
  }

  async createChecklistItem(
    taskId: string,
    dto: CreateTaskChecklistItemDto,
    userId: string,
  ) {
    const task = await this.findTaskOrFail(taskId);
    await this.ensureCanEditTaskChecklist(task, userId);

    const position = await this.getNextChecklistItemPosition(taskId);
    const item = this.checklistItemRepository.create({
      task_id: taskId,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? '',
      created_by: userId,
      updated_by: userId,
      position,
    });
    const savedItem = await this.checklistItemRepository.save(item);
    await this.syncTaskProgress(taskId, task.status);
    this.realtimeGateway.emitProjectEvent(task.project_id, 'task.updated', {
      task_id: taskId,
    });

    return savedItem;
  }

  async updateChecklistItem(
    itemId: string,
    dto: UpdateTaskChecklistItemDto,
    userId: string,
  ) {
    const item = await this.findChecklistItemOrFail(itemId);
    await this.ensureCanEditTaskChecklist(item.task, userId);

    const nextCompleted =
      dto.completed === undefined ? item.completed : dto.completed;

    Object.assign(item, {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && {
        description: dto.description?.trim() ?? '',
      }),
      ...(dto.completed !== undefined && {
        completed: dto.completed,
        completed_at: dto.completed ? new Date() : null,
        completed_by: dto.completed ? userId : null,
      }),
      updated_by: userId,
    });
    if (nextCompleted === item.completed && dto.completed === undefined) {
      item.updated_by = userId;
    }
    const savedItem = await this.checklistItemRepository.save(item);
    await this.syncTaskProgress(item.task_id, item.task.status);
    this.realtimeGateway.emitProjectEvent(item.task.project_id, 'task.updated', {
      task_id: item.task_id,
    });

    return savedItem;
  }

  async deleteChecklistItem(itemId: string, userId: string) {
    const item = await this.findChecklistItemOrFail(itemId);
    await this.ensureCanEditTaskChecklist(item.task, userId);
    await this.checklistItemRepository.delete(itemId);
    await this.syncTaskProgress(item.task_id, item.task.status);
    this.realtimeGateway.emitProjectEvent(item.task.project_id, 'task.updated', {
      task_id: item.task_id,
    });

    return { message: 'Checklist item deleted', checklist_item_id: itemId };
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
    await this.notificationsService.createMany(
      userIds.map((assignedUserId) => ({
        userId: assignedUserId,
        projectId: task.project_id,
        taskId,
        type: NotificationType.TASK_ASSIGNED,
        title: 'Bạn được giao task',
        message: task.title,
      })),
    );
    this.realtimeGateway.emitProjectEvent(task.project_id, 'task.assigned', {
      task_id: taskId,
      user_ids: userIds,
    });

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
    this.realtimeGateway.emitProjectEvent(task.project_id, 'task.unassigned', {
      task_id: taskId,
      user_ids: userIds,
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
        status: In(this.getEditableProjectStatuses()),
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
        where: {
          project_id: projectId,
          status: In(this.getEditableProjectStatuses()),
        },
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

  private async canManageProject(projectId: string, userId: string) {
    const membership = await this.getActiveProjectMembership(projectId, userId);
    return this.isManager(membership.role);
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

  private getEditableProjectStatuses() {
    return [StatusEnum.NEW, StatusEnum.IN_PROGRESS, StatusEnum.PAUSED];
  }

  private async isTaskAssignee(taskId: string, userId: string) {
    return Boolean(
      await this.taskAssigneeRepository.findOne({
        where: { task_id: taskId, user_id: userId },
      }),
    );
  }

  private async ensureCanEditTaskChecklist(task: Task, userId: string) {
    const progress = await this.calculateTaskProgress(task.task_id, task.status);
    if (task.status === TaskStatus.DONE && progress === 100) {
      throw new ForbiddenException(
        'Task đã hoàn thành 100%, hãy hạ trạng thái trước khi sửa checklist',
      );
    }

    const canManageProject = await this.canManageProject(task.project_id, userId);
    const isAssignee = await this.isTaskAssignee(task.task_id, userId);

    if (!canManageProject && !isAssignee) {
      throw new ForbiddenException(
        'Chỉ owner, manager hoặc assignee của task được sửa checklist',
      );
    }
  }

  private async findChecklistItemOrFail(itemId: string) {
    const item = await this.checklistItemRepository.findOne({
      where: { checklist_item_id: itemId },
      relations: { task: true },
    });

    if (!item) {
      throw new NotFoundException('Không tìm thấy checklist item');
    }

    return item;
  }

  private async getNextChecklistItemPosition(taskId: string) {
    const result = await this.checklistItemRepository
      .createQueryBuilder('item')
      .select('COALESCE(MAX(item.position), 0)', 'max')
      .where('item.task_id = :taskId', { taskId })
      .getRawOne<{ max: string | number }>();

    return Number(result?.max ?? 0) + 1;
  }

  private getStatusProgress(status: TaskStatus) {
    const progressByStatus: Record<TaskStatus, number> = {
      [TaskStatus.TODO]: 0,
      [TaskStatus.PROGRESS]: 25,
      [TaskStatus.REJECT]: 25,
      [TaskStatus.SUBMITTED]: 50,
      [TaskStatus.REVIEW]: 75,
      [TaskStatus.DONE]: 100,
    };

    return progressByStatus[status] ?? 0;
  }

  private async calculateTaskProgress(taskId: string, status: TaskStatus) {
    const checklist = await this.checklistItemRepository.find({
      where: { task_id: taskId },
      select: { completed: true },
    });

    const statusProgress = this.getStatusProgress(status);

    if (checklist.length === 0) return statusProgress;

    const completed = checklist.filter((item) => item.completed).length;
    const checklistProgress = Math.round((completed / checklist.length) * 100);

    return Math.max(statusProgress, checklistProgress);
  }

  private async syncTaskProgress(taskId: string, status: TaskStatus) {
    const progress = await this.calculateTaskProgress(taskId, status);
    await this.taskRepository.update(taskId, { progress });
    return progress;
  }

  private async isOnlyTaskAssignee(taskId: string, userId: string) {
    const assignees = await this.taskAssigneeRepository.find({
      where: { task_id: taskId },
      select: { user_id: true },
    });

    return assignees.length === 1 && assignees[0]?.user_id === userId;
  }

  private validateStatusTransition(
    current: TaskStatus,
    next: TaskStatus,
    canManage: boolean,
    isAssignee: boolean,
    isOwnerSelfAssignedTask = false,
  ) {
    if (isOwnerSelfAssignedTask) {
      const ownerSelfStatuses = [
        TaskStatus.TODO,
        TaskStatus.PROGRESS,
        TaskStatus.DONE,
      ];

      if (
        ownerSelfStatuses.includes(current) &&
        ownerSelfStatuses.includes(next)
      ) {
        return;
      }

      throw new ForbiddenException(
        'Task tự giao cho owner chỉ được chuyển giữa todo, in progress và done',
      );
    }

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

    if (canManage) return;
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

  private validateTaskDates(
    startDate?: string | Date | null,
    dueDate?: string | Date | null,
  ) {
    if (!startDate || !dueDate) return;

    if (new Date(dueDate).getTime() < new Date(startDate).getTime()) {
      throw new BadRequestException(
        'Ngày kết thúc không được trước ngày bắt đầu',
      );
    }
  }

  private async ensureProjectOwner(projectId: string, userId: string) {
    const project = await this.projectRepository.findOne({
      where: {
        project_id: projectId,
        status: In(this.getEditableProjectStatuses()),
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

  private async shiftSiblingPositionsDown(
    projectId: string,
    parentTaskId?: string,
  ) {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .update(Task)
      .set({ position: () => 'position + 1' })
      .where('project_id = :projectId', { projectId });

    if (parentTaskId) {
      query.andWhere('parent_task_id = :parentTaskId', { parentTaskId });
    } else {
      query.andWhere('parent_task_id IS NULL');
    }

    await query.execute();
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
      .andWhere('project.status IN (:...statuses)', {
        statuses: this.getEditableProjectStatuses(),
      });

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
