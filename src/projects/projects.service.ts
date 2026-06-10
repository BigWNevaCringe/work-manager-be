import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, StatusEnum } from './entities/project.entity';
import {
  MemberRoleEnum,
  ProjectMember,
} from '../project-members/project-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';

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
  ) {}

  async create(createProjectDto: CreateProjectDto, userId: string) {
    const project = this.projectRepository.create({
      ...createProjectDto,
      owner_id: userId,
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
    const projects = await this.projectRepository
      .createQueryBuilder('project')
      .innerJoin('project.members', 'currentMember')
      .leftJoinAndSelect('project.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('project.tasks', 'task')
      .leftJoinAndSelect('task.assignees', 'taskAssignee')
      .leftJoinAndSelect('taskAssignee.user', 'taskAssigneeUser')
      .where('currentMember.project_id = :id', { id })
      .andWhere('currentMember.user_id = :userId', { userId })
      .getMany();

    return projects.map((project) => this.formatProject(project));
  }

  async findActive(userId: string) {
    const projects = await this.projectRepository
      .createQueryBuilder('project')
      .innerJoin('project.members', 'currentMember')
      .leftJoinAndSelect('project.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('project.tasks', 'task')
      .leftJoinAndSelect('task.assignees', 'taskAssignee')
      .leftJoinAndSelect('taskAssignee.user', 'taskAssigneeUser')
      .where('currentMember.user_id = :userId', { userId })
      .andWhere('project.status = :status', { status: StatusEnum.ACTIVE })
      .getMany();

    return projects.map((project) => this.formatProject(project));
  }

  async findCompleted(userId: string) {
    const projects = await this.projectRepository
      .createQueryBuilder('project')
      .innerJoin('project.members', 'currentMember')
      .leftJoinAndSelect('project.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('project.tasks', 'task')
      .leftJoinAndSelect('task.assignees', 'taskAssignee')
      .leftJoinAndSelect('taskAssignee.user', 'taskAssigneeUser')
      .where('currentMember.user_id = :userId', { userId })
      .andWhere('project.status = :status', { status: StatusEnum.COMPLETED })
      .getMany();

    return projects.map((project) => this.formatProject(project));
  }

  async findArchived(userId: string) {
    const projects = await this.projectRepository
      .createQueryBuilder('project')
      .innerJoin('project.members', 'currentMember')
      .leftJoinAndSelect('project.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('project.tasks', 'task')
      .leftJoinAndSelect('task.assignees', 'taskAssignee')
      .leftJoinAndSelect('taskAssignee.user', 'taskAssigneeUser')
      .where('currentMember.user_id = :userId', { userId })
      .andWhere('project.status = :status', { status: StatusEnum.ARCHIVED })
      .getMany();

    return projects.map((project) => this.formatProject(project));
  }

  async update(id: string, updateProjectDto: UpdateProjectDto, userId: string) {
    const project = await this.findOwnedActiveProject(id, userId);

    Object.assign(project, updateProjectDto);

    return this.projectRepository.save(project);
  }

  async addMember(
    projectId: string,
    addProjectMemberDto: AddProjectMemberDto,
    userId: string,
  ) {
    await this.findOwnedActiveProject(projectId, userId);

    const user = await this.userRepository.findOne({
      where: { user_id: addProjectMemberDto.user_id },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy user');
    }

    const existingMember = await this.projectMemberRepository.findOne({
      where: {
        project_id: projectId,
        user_id: addProjectMemberDto.user_id,
      },
    });

    if (existingMember) {
      throw new ConflictException('User đã là thành viên của dự án');
    }

    const member = this.projectMemberRepository.create({
      project_id: projectId,
      user_id: addProjectMemberDto.user_id,
      role: MemberRoleEnum.MEMBER,
    });

    await this.projectMemberRepository.save(member);

    return {
      message: 'Đã thêm user vào dự án',
      project_id: projectId,
      user_id: addProjectMemberDto.user_id,
      role: MemberRoleEnum.MEMBER,
    };
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

    if (project.owner_id !== userId) {
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
}
