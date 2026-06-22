import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';
import { ReorderProjectsDto } from './dto/reorder-projects.dto';
import { UpdateProjectMemberRoleDto } from './dto/update-project-member-role.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { RemoveProjectMembersDto } from './dto/remove-project-members.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Project, StatusEnum } from './entities/project.entity';
import {
  MemberRoleEnum,
  ProjectMember,
} from '../project-members/project-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskAssignee } from '../task-assignees/task-assignee.entity';
import { User, UserRoleEnum } from '../users/entities/user.entity';
import { Comment } from '../comments/entities/comment.entity';

type FormattedTaskBase = {
  task_id: string;
  parent_task_id?: string;
  title: string;
  description: string;
  status: Task['status'];
  priority: Task['priority'];
  progress: number;
  position: number;
  start_date: Date;
  due_date: Date;
  created_by: string;
  assignees: {
    user_id: string;
    email?: string;
    name?: string;
    avatar_url?: string;
    assigned_at: Date;
  }[];
};

export type FormattedSubtask = FormattedTaskBase;

export type FormattedTask = FormattedTaskBase & {
  subtasks: FormattedSubtask[];
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(TaskAssignee)
    private readonly taskAssigneeRepository: Repository<TaskAssignee>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  async create(createProjectDto: CreateProjectDto, userId: string) {
    await this.checkExistingName(createProjectDto.project_name, userId);

    const position = await this.getNextProjectPosition(
      userId,
      StatusEnum.ACTIVE,
    );

    const project = this.projectRepository.create({
      ...createProjectDto,
      owner_id: userId,
      position,
    });

    const savedProject = await this.projectRepository.save(project);

    const ownerMember = this.projectMemberRepository.create({
      project_id: savedProject.project_id,
      user_id: userId,
      role: MemberRoleEnum.OWNER,
    });

    await this.projectMemberRepository.save(ownerMember);

    const createdProject = await this.projectRepository.findOne({
      where: { project_id: savedProject.project_id },
      relations: {
        members: {
          user: true,
        },
        tasks: true,
      },
    });

    return this.formatProject(createdProject);
  }

  async findOneByProjectId(id: string, userId: string) {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('project.tasks', 'task')
      .leftJoinAndSelect('task.assignees', 'taskAssignee')
      .leftJoinAndSelect('taskAssignee.user', 'taskAssigneeUser')
      .where('project.project_id = :id', { id });

    if (!(await this.isSystemAdmin(userId))) {
      query
        .innerJoin('project.members', 'currentMember')
        .andWhere('currentMember.user_id = :userId', { userId });
    }

    const project = await query.getOne();

    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án');
    }

    return this.formatProject(project);
  }

  async findActive(userId: string) {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('project.tasks', 'task')
      .leftJoinAndSelect('task.assignees', 'taskAssignee')
      .leftJoinAndSelect('taskAssignee.user', 'taskAssigneeUser')
      .where('project.status = :status', { status: StatusEnum.ACTIVE })
      .orderBy('project.position', 'ASC');
    if (!(await this.isSystemAdmin(userId))) {
      query
        .innerJoin('project.members', 'currentMember')
        .andWhere('currentMember.user_id = :userId', { userId });
    }
    const projects = await query.getMany();

    return projects.map((project) => this.formatProject(project));
  }

  async findCompleted(userId: string) {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('project.tasks', 'task')
      .leftJoinAndSelect('task.assignees', 'taskAssignee')
      .leftJoinAndSelect('taskAssignee.user', 'taskAssigneeUser')
      .where('project.status = :status', { status: StatusEnum.COMPLETED })
      .orderBy('project.position', 'ASC');
    if (!(await this.isSystemAdmin(userId))) {
      query
        .innerJoin('project.members', 'currentMember')
        .andWhere('currentMember.user_id = :userId', { userId });
    }
    const projects = await query.getMany();

    return projects.map((project) => this.formatProject(project));
  }

  async findArchived(userId: string) {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('project.tasks', 'task')
      .leftJoinAndSelect('task.assignees', 'taskAssignee')
      .leftJoinAndSelect('taskAssignee.user', 'taskAssigneeUser')
      .where('project.status = :status', { status: StatusEnum.ARCHIVED })
      .orderBy('project.position', 'ASC');
    if (!(await this.isSystemAdmin(userId))) {
      query
        .innerJoin('project.members', 'currentMember')
        .andWhere('currentMember.user_id = :userId', { userId });
    }
    const projects = await query.getMany();

    return projects.map((project) => this.formatProject(project));
  }

  async update(id: string, updateProjectDto: UpdateProjectDto, userId: string) {
    const project = await this.findOwnedActiveProject(id, userId);

    if (updateProjectDto.project_name) {
      await this.checkExistingName(updateProjectDto.project_name, userId, id);
    }

    Object.assign(project, updateProjectDto);

    return this.projectRepository.save(project);
  }

  async remove(id: string, userId: string) {
    const project = await this.findOwnedActiveProject(id, userId);

    project.status = StatusEnum.ARCHIVED;
    project.archived_at = new Date();

    await this.projectRepository.save(project);

    return {
      message: 'Dự án đã được tạm thời xóa',
      project_id: project.project_id,
      status: project.status,
      archived_at: project.archived_at,
    };
  }

  async permanentlyRemove(id: string, userId: string) {
    const project = await this.findOwnedProject(id, userId);
    if (project.status !== StatusEnum.ARCHIVED) {
      throw new ConflictException('Chỉ có thể xóa vĩnh viễn dự án đã archived');
    }

    const tasks = await this.taskRepository.find({
      where: { project_id: id },
      select: { task_id: true },
    });
    const taskIds = tasks.map((task) => task.task_id);

    await this.commentRepository.delete({ project_id: id });
    if (taskIds.length > 0) {
      await this.taskAssigneeRepository.delete({ task_id: In(taskIds) });
      await this.taskRepository.delete({
        project_id: id,
        parent_task_id: Not(IsNull()),
      });
      await this.taskRepository.delete({ project_id: id });
    }
    await this.projectMemberRepository.delete({ project_id: id });
    await this.projectRepository.delete({ project_id: id });

    return { message: 'Đã xóa vĩnh viễn dự án', project_id: id };
  }

  async updateStatus(
    id: string,
    updateProjectStatusDto: UpdateProjectStatusDto,
    userId: string,
  ) {
    const project = await this.findOwnedProject(id, userId);

    project.status = updateProjectStatusDto.status;
    project.archived_at =
      updateProjectStatusDto.status === StatusEnum.ARCHIVED ? new Date() : null;

    const savedProject = await this.projectRepository.save(project);

    return this.formatProject(savedProject);
  }

  async reorder(reorderProjectsDto: ReorderProjectsDto, userId: string) {
    const isAdmin = await this.isSystemAdmin(userId);
    const memberships = isAdmin
      ? []
      : await this.projectMemberRepository.find({ where: { user_id: userId } });
    const projects = await this.projectRepository.find({
      where: isAdmin
        ? { status: reorderProjectsDto.status }
        : {
            project_id: In(
              memberships.map((membership) => membership.project_id),
            ),
            status: reorderProjectsDto.status,
          },
    });
    const projectIds = new Set(projects.map((project) => project.project_id));

    if (
      projects.length !== reorderProjectsDto.project_ids.length ||
      reorderProjectsDto.project_ids.some((id) => !projectIds.has(id))
    ) {
      throw new ConflictException(
        'Danh sách sắp xếp phải chứa đầy đủ project cùng trạng thái',
      );
    }

    const projectsById = new Map(
      projects.map((project) => [project.project_id, project]),
    );
    const reorderedProjects = reorderProjectsDto.project_ids.map(
      (projectId, index) => {
        const project = projectsById.get(projectId)!;
        project.position = index + 1;
        return project;
      },
    );

    await this.projectRepository.save(reorderedProjects);

    return {
      message: 'Đã cập nhật thứ tự project',
      status: reorderProjectsDto.status,
      project_ids: reorderProjectsDto.project_ids,
    };
  }

  async addMembers(
    projectId: string,
    addProjectMemberDto: AddProjectMemberDto,
    userId: string,
  ) {
    await this.findOwnedActiveProject(projectId, userId);
    const userIds = addProjectMemberDto.user_ids;

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

    const existingMembers = await this.projectMemberRepository.find({
      where: {
        project_id: projectId,
        user_id: In(userIds),
      },
    });
    const existingMemberIds = existingMembers.map((member) => member.user_id);

    if (existingMemberIds.length > 0) {
      throw new ConflictException({
        message: 'User đã là thành viên của dự án',
        user_ids: existingMemberIds,
      });
    }

    const members = this.projectMemberRepository.create(
      userIds.map((memberUserId) => ({
        project_id: projectId,
        user_id: memberUserId,
        role: MemberRoleEnum.MEMBER,
      })),
    );

    await this.projectMemberRepository.save(members);

    return {
      message: 'Đã thêm user vào dự án',
      project_id: projectId,
      user_ids: userIds,
      role: MemberRoleEnum.MEMBER,
    };
  }

  async findMemberCandidates(
    projectId: string,
    search: string,
    userId: string,
  ) {
    await this.findOwnedActiveProject(projectId, userId);

    const existingMembers = await this.projectMemberRepository.find({
      where: { project_id: projectId },
    });
    const existingIds = existingMembers.map((member) => member.user_id);
    const query = this.userRepository
      .createQueryBuilder('user')
      .select(['user.user_id', 'user.name', 'user.email', 'user.avatar_url'])
      .orderBy('user.name', 'ASC')
      .take(20);

    if (search?.trim()) {
      query.where('(user.name ILIKE :search OR user.email ILIKE :search)', {
        search: `%${search.trim()}%`,
      });
    }

    if (existingIds.length > 0) {
      query.andWhere('user.user_id NOT IN (:...existingIds)', { existingIds });
    }

    return query.getMany();
  }

  async updateMemberRole(
    projectId: string,
    memberId: string,
    dto: UpdateProjectMemberRoleDto,
    userId: string,
  ) {
    const project = await this.findOwnedActiveProject(projectId, userId);
    if (memberId === project.owner_id) {
      throw new ConflictException('Không thể thay đổi role của owner');
    }

    const member = await this.projectMemberRepository.findOne({
      where: { project_id: projectId, user_id: memberId },
    });
    if (!member) throw new NotFoundException('User không thuộc project');

    member.role = dto.role;
    await this.projectMemberRepository.save(member);

    return { project_id: projectId, user_id: memberId, role: member.role };
  }

  async removeMembers(
    projectId: string,
    removeProjectMembersDto: RemoveProjectMembersDto,
    userId: string,
  ) {
    const project = await this.findOwnedActiveProject(projectId, userId);
    const userIds = removeProjectMembersDto.user_ids;

    if (userIds.includes(project.owner_id)) {
      throw new ConflictException('Không thể xóa owner khỏi dự án');
    }

    const existingMembers = await this.projectMemberRepository.find({
      where: {
        project_id: projectId,
        user_id: In(userIds),
      },
    });
    const existingMemberIds = new Set(
      existingMembers.map((member) => member.user_id),
    );
    const missingMemberIds = userIds.filter((id) => !existingMemberIds.has(id));

    if (missingMemberIds.length > 0) {
      throw new NotFoundException({
        message: 'User không phải là thành viên của dự án',
        user_ids: missingMemberIds,
      });
    }

    const projectTasks = await this.taskRepository.find({
      where: { project_id: projectId },
      select: { task_id: true },
    });
    const taskIds = projectTasks.map((task) => task.task_id);

    if (taskIds.length > 0) {
      await this.taskAssigneeRepository.delete({
        task_id: In(taskIds),
        user_id: In(userIds),
      });
    }

    await this.projectMemberRepository.delete({
      project_id: projectId,
      user_id: In(userIds),
    });

    return {
      message: 'Đã xóa user khỏi dự án',
      project_id: projectId,
      user_ids: userIds,
    };
  }

  /////////////////////////////////

  private async findOwnedActiveProject(projectId: string, userId: string) {
    const project = await this.projectRepository.findOne({
      where: {
        project_id: projectId,
        status: StatusEnum.ACTIVE,
      },
    });

    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án');
    }

    if (project.owner_id !== userId && !(await this.isSystemAdmin(userId))) {
      throw new ForbiddenException('Bạn không có quyền thao tác với dự án này');
    }

    return project;
  }

  private async findOwnedProject(projectId: string, userId: string) {
    const project = await this.projectRepository.findOne({
      where: { project_id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án');
    }

    if (project.owner_id !== userId && !(await this.isSystemAdmin(userId))) {
      throw new ForbiddenException('Bạn không có quyền thao tác với dự án này');
    }

    return project;
  }

  private formatProject(project: Project | null) {
    if (!project) return null;

    return {
      ...project,
      members:
        project.members?.map((member) => ({
          user_id: member.user?.user_id ?? member.user_id,
          email: member.user?.email,
          name: member.user?.name,
          avatar_url: member.user?.avatar_url,
          role: member.role,
          joined_at: member.joined_at,
        })) ?? [],
      tasks: this.formatTasks(project.tasks),
    };
  }

  private formatTasks(tasks: Task[] = []) {
    const tasksById = new Map<string, FormattedTask>();

    for (const task of tasks) {
      tasksById.set(task.task_id, {
        task_id: task.task_id,
        parent_task_id: task.parent_task_id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        progress: task.progress,
        position: task.position,
        start_date: task.start_date,
        due_date: task.due_date,
        created_by: task.created_by,
        assignees:
          task.assignees?.map((assignee) => ({
            user_id: assignee.user?.user_id ?? assignee.user_id,
            email: assignee.user?.email,
            name: assignee.user?.name,
            avatar_url: assignee.user?.avatar_url,
            assigned_at: assignee.assigned_at,
          })) ?? [],
        subtasks: [],
      });
    }

    const rootTasks: FormattedTask[] = [];

    for (const task of tasksById.values()) {
      if (task.parent_task_id) {
        const parentTask = tasksById.get(task.parent_task_id);

        if (parentTask) {
          const { subtasks, ...subtask } = task;
          void subtasks;
          parentTask.subtasks.push(subtask);
          continue;
        }
      }

      rootTasks.push(task);
    }

    const sortByPosition = (currentTasks: FormattedTask[]) => {
      currentTasks.sort((a, b) => a.position - b.position);
      currentTasks.forEach((task) =>
        task.subtasks.sort((a, b) => a.position - b.position),
      );
    };

    sortByPosition(rootTasks);

    return rootTasks;
  }

  private async checkExistingName(
    project_name: string,
    userId: string,
    excludeProjectId?: string,
  ) {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .innerJoin('project.members', 'member')
      .where('member.user_id = :userId', { userId })
      .andWhere('project.project_name = :project_name', { project_name })
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

  private async getNextProjectPosition(userId: string, status: StatusEnum) {
    const result = await this.projectRepository
      .createQueryBuilder('project')
      .select('COALESCE(MAX(project.position), 0)', 'max')
      .where('project.owner_id = :userId', { userId })
      .andWhere('project.status = :status', { status })
      .getRawOne<{ max: string | number }>();

    return Number(result?.max ?? 0) + 1;
  }

  private async isSystemAdmin(userId: string) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });
    return user?.role === UserRoleEnum.ADMIN;
  }
}
