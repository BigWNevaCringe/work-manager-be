import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task, TaskPriorityEnum, TaskStatus } from './entities/task.entity';
import { TaskChecklistItem } from './entities/task-checklist-item.entity';
import { Project, StatusEnum } from '../projects/entities/project.entity';
import { ProjectMember } from '../project-members/project-member.entity';
import { TaskAssignee } from '../task-assignees/task-assignee.entity';
import { User } from '../users/entities/user.entity';
import { MemberRoleEnum } from '../project-members/project-member.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepository: Record<string, jest.Mock>;
  let projectRepository: Record<string, jest.Mock>;
  let projectMemberRepository: Record<string, jest.Mock>;
  let taskAssigneeRepository: Record<string, jest.Mock>;
  let checklistItemRepository: Record<string, jest.Mock>;
  let userRepository: Record<string, jest.Mock>;

  const createRepositoryMock = () => ({
    create: jest.fn((value) => value),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((value) => value),
    update: jest.fn(),
  });

  const taskId = '11111111-1111-1111-1111-111111111111';
  const projectId = '22222222-2222-2222-2222-222222222222';
  const ownerId = '33333333-3333-3333-3333-333333333333';
  const firstUserId = '44444444-4444-4444-4444-444444444444';
  const secondUserId = '55555555-5555-5555-5555-555555555555';

  const mockTaskAndOwner = () => {
    taskRepository.findOne.mockResolvedValue({
      task_id: taskId,
      project_id: projectId,
      status: TaskStatus.PROGRESS,
    });
    projectRepository.findOne.mockResolvedValue({
      project_id: projectId,
      owner_id: ownerId,
      status: StatusEnum.IN_PROGRESS,
    });
    projectMemberRepository.findOne.mockResolvedValue({
      user_id: ownerId,
      role: MemberRoleEnum.OWNER,
    });
  };

  beforeEach(async () => {
    taskRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    projectMemberRepository = createRepositoryMock();
    taskAssigneeRepository = createRepositoryMock();
    checklistItemRepository = createRepositoryMock();
    userRepository = createRepositoryMock();
    taskAssigneeRepository.find.mockResolvedValue([]);
    checklistItemRepository.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(Task),
          useValue: taskRepository,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: projectMemberRepository,
        },
        {
          provide: getRepositoryToken(TaskAssignee),
          useValue: taskAssigneeRepository,
        },
        {
          provide: getRepositoryToken(TaskChecklistItem),
          useValue: checklistItemRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: RealtimeGateway,
          useValue: {
            emitProjectEvent: jest.fn(),
            emitMemberProjectEvent: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createMany: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('updates task priority and derives progress from status when there is no checklist', async () => {
      mockTaskAndOwner();
      taskAssigneeRepository.findOne.mockResolvedValue({ user_id: ownerId });

      await service.update(
        taskId,
        {
          priority: TaskPriorityEnum.HIGH,
          progress: 100,
        },
        ownerId,
      );

      expect(taskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.PROGRESS,
          priority: TaskPriorityEnum.HIGH,
          progress: 25,
        }),
      );
    });

    it('allows an assigned member to submit work', async () => {
      taskRepository.findOne.mockResolvedValue({
        task_id: taskId,
        project_id: projectId,
        status: TaskStatus.PROGRESS,
        progress: 70,
      });
      projectRepository.findOne.mockResolvedValue({
        project_id: projectId,
        status: StatusEnum.IN_PROGRESS,
      });
      projectMemberRepository.findOne.mockResolvedValue({
        user_id: firstUserId,
        role: MemberRoleEnum.MEMBER,
      });
      taskAssigneeRepository.findOne.mockResolvedValue({
        task_id: taskId,
        user_id: firstUserId,
      });

      await service.update(
        taskId,
        { status: TaskStatus.SUBMITTED },
        firstUserId,
      );

      expect(taskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TaskStatus.SUBMITTED }),
      );
    });

    it('does not allow a member to edit task details', async () => {
      taskRepository.findOne.mockResolvedValue({
        task_id: taskId,
        project_id: projectId,
        status: TaskStatus.PROGRESS,
      });
      projectRepository.findOne.mockResolvedValue({
        project_id: projectId,
        status: StatusEnum.IN_PROGRESS,
      });
      projectMemberRepository.findOne.mockResolvedValue({
        user_id: firstUserId,
        role: MemberRoleEnum.MEMBER,
      });

      await expect(
        service.update(taskId, { title: 'Not allowed' }, firstUserId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a manager to review submitted work', async () => {
      taskRepository.findOne.mockResolvedValue({
        task_id: taskId,
        project_id: projectId,
        status: TaskStatus.SUBMITTED,
      });
      projectRepository.findOne.mockResolvedValue({
        project_id: projectId,
        status: StatusEnum.IN_PROGRESS,
      });
      projectMemberRepository.findOne.mockResolvedValue({
        user_id: firstUserId,
        role: MemberRoleEnum.MANAGER,
      });
      taskAssigneeRepository.findOne.mockResolvedValue(null);

      await service.update(taskId, { status: TaskStatus.REVIEW }, firstUserId);

      expect(taskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TaskStatus.REVIEW }),
      );
    });
  });

  describe('reorder', () => {
    it('updates sibling positions in the requested order', async () => {
      projectRepository.findOne.mockResolvedValue({
        project_id: projectId,
        status: StatusEnum.IN_PROGRESS,
      });
      projectMemberRepository.findOne.mockResolvedValue({
        user_id: ownerId,
        role: MemberRoleEnum.OWNER,
      });
      taskRepository.find.mockResolvedValue([
        { task_id: taskId, project_id: projectId, position: 1 },
        { task_id: firstUserId, project_id: projectId, position: 2 },
      ]);

      await service.reorder(
        projectId,
        { task_ids: [firstUserId, taskId] },
        ownerId,
      );

      expect(taskRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ task_id: firstUserId, position: 1 }),
        expect.objectContaining({ task_id: taskId, position: 2 }),
      ]);
    });

    it('rejects an incomplete sibling list', async () => {
      projectRepository.findOne.mockResolvedValue({
        project_id: projectId,
        status: StatusEnum.IN_PROGRESS,
      });
      projectMemberRepository.findOne.mockResolvedValue({
        user_id: ownerId,
        role: MemberRoleEnum.OWNER,
      });
      taskRepository.find.mockResolvedValue([
        { task_id: taskId, project_id: projectId, position: 1 },
        { task_id: firstUserId, project_id: projectId, position: 2 },
      ]);

      await expect(
        service.reorder(projectId, { task_ids: [taskId] }, ownerId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('assignUsers', () => {
    it('assigns multiple users to a task', async () => {
      mockTaskAndOwner();
      userRepository.find.mockResolvedValue([
        { user_id: firstUserId },
        { user_id: secondUserId },
      ]);
      projectMemberRepository.find.mockResolvedValue([
        { user_id: firstUserId },
        { user_id: secondUserId },
      ]);
      taskAssigneeRepository.find.mockResolvedValue([]);

      const result = await service.assignUsers(
        taskId,
        { user_ids: [firstUserId, secondUserId] },
        ownerId,
      );

      expect(taskAssigneeRepository.create).toHaveBeenCalledWith([
        { task_id: taskId, user_id: firstUserId },
        { task_id: taskId, user_id: secondUserId },
      ]);
      expect(taskAssigneeRepository.save).toHaveBeenCalledWith([
        { task_id: taskId, user_id: firstUserId },
        { task_id: taskId, user_id: secondUserId },
      ]);
      expect(result).toEqual({
        message: 'Đã phân công user vào task',
        task_id: taskId,
        user_ids: [firstUserId, secondUserId],
      });
    });

    it('throws when any user does not exist', async () => {
      mockTaskAndOwner();
      userRepository.find.mockResolvedValue([{ user_id: firstUserId }]);

      await expect(
        service.assignUsers(
          taskId,
          { user_ids: [firstUserId, secondUserId] },
          ownerId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when any user is not a project member', async () => {
      mockTaskAndOwner();
      userRepository.find.mockResolvedValue([
        { user_id: firstUserId },
        { user_id: secondUserId },
      ]);
      projectMemberRepository.find.mockResolvedValue([
        { user_id: firstUserId },
      ]);

      await expect(
        service.assignUsers(
          taskId,
          { user_ids: [firstUserId, secondUserId] },
          ownerId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when any user is already assigned', async () => {
      mockTaskAndOwner();
      userRepository.find.mockResolvedValue([
        { user_id: firstUserId },
        { user_id: secondUserId },
      ]);
      projectMemberRepository.find.mockResolvedValue([
        { user_id: firstUserId },
        { user_id: secondUserId },
      ]);
      taskAssigneeRepository.find.mockResolvedValue([
        { user_id: secondUserId },
      ]);

      await expect(
        service.assignUsers(
          taskId,
          { user_ids: [firstUserId, secondUserId] },
          ownerId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('unassignUsers', () => {
    it('removes multiple users from a task', async () => {
      mockTaskAndOwner();
      taskAssigneeRepository.find.mockResolvedValue([
        { user_id: firstUserId },
        { user_id: secondUserId },
      ]);

      const result = await service.unassignUsers(
        taskId,
        { user_ids: [firstUserId, secondUserId] },
        ownerId,
      );

      expect(taskAssigneeRepository.delete).toHaveBeenCalledWith({
        task_id: taskId,
        user_id: expect.any(Object),
      });
      expect(result).toEqual({
        message: 'Đã gỡ user khỏi task',
        task_id: taskId,
        user_ids: [firstUserId, secondUserId],
      });
    });

    it('throws when any user is not assigned to the task', async () => {
      mockTaskAndOwner();
      taskAssigneeRepository.find.mockResolvedValue([{ user_id: firstUserId }]);

      await expect(
        service.unassignUsers(
          taskId,
          { user_ids: [firstUserId, secondUserId] },
          ownerId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
