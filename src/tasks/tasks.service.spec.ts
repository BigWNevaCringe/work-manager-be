import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectMember } from '../project-members/project-member.entity';
import { TaskAssignee } from '../task-assignees/task-assignee.entity';
import { User } from '../users/entities/user.entity';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepository: Record<string, jest.Mock>;
  let projectRepository: Record<string, jest.Mock>;
  let projectMemberRepository: Record<string, jest.Mock>;
  let taskAssigneeRepository: Record<string, jest.Mock>;
  let userRepository: Record<string, jest.Mock>;

  const createRepositoryMock = () => ({
    create: jest.fn((value) => value),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((value) => value),
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
    });
    projectRepository.findOne.mockResolvedValue({
      project_id: projectId,
      owner_id: ownerId,
      status: 'active',
    });
  };

  beforeEach(async () => {
    taskRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    projectMemberRepository = createRepositoryMock();
    taskAssigneeRepository = createRepositoryMock();
    userRepository = createRepositoryMock();

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
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
