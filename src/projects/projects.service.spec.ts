import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Project,
  ProjectPriorityEnum,
  StatusEnum,
} from './entities/project.entity';
import {
  MemberRoleEnum,
  ProjectMember,
} from '../project-members/project-member.entity';
import { User } from '../users/entities/user.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskAssignee } from '../task-assignees/task-assignee.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectRepository: Record<string, jest.Mock>;
  let projectMemberRepository: Record<string, jest.Mock>;
  let userRepository: Record<string, jest.Mock>;
  let taskRepository: Record<string, jest.Mock>;
  let taskAssigneeRepository: Record<string, jest.Mock>;
  let realtimeGateway: Record<string, jest.Mock>;

  const createRepositoryMock = () => ({
    create: jest.fn((value) => value),
    save: jest.fn((value) => value),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const projectId = '11111111-1111-1111-1111-111111111111';
  const ownerId = '22222222-2222-2222-2222-222222222222';
  const firstUserId = '33333333-3333-3333-3333-333333333333';
  const secondUserId = '44444444-4444-4444-4444-444444444444';

  const activeProject = {
    project_id: projectId,
    owner_id: ownerId,
    status: StatusEnum.IN_PROGRESS,
  };
  const updateProjectDto = {
    project_name: '',
    project_description: 'Updated description',
    priority: ProjectPriorityEnum.MEDIUM,
    start_date: '2026-07-04',
    end_date: '2026-08-04',
  };

  const mockOwnedProject = () => {
    projectRepository.findOne.mockResolvedValue(activeProject);
  };

  beforeEach(async () => {
    projectRepository = createRepositoryMock();
    projectMemberRepository = createRepositoryMock();
    userRepository = createRepositoryMock();
    taskRepository = createRepositoryMock();
    taskAssigneeRepository = createRepositoryMock();
    realtimeGateway = {
      emitProjectEvent: jest.fn(),
      emitMemberProjectEvent: jest.fn(),
    };
    projectMemberRepository.find.mockResolvedValue([]);
    taskRepository.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: projectMemberRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: taskRepository,
        },
        {
          provide: getRepositoryToken(TaskAssignee),
          useValue: taskAssigneeRepository,
        },
        {
          provide: RealtimeGateway,
          useValue: realtimeGateway,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('updates an active project', async () => {
      mockOwnedProject();

      await service.update(
        projectId,
        updateProjectDto,
        ownerId,
      );

      expect(projectRepository.findOne).toHaveBeenCalledWith({
        where: {
          project_id: projectId,
          status: expect.any(Object),
        },
      });
      expect(projectRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          project_description: 'Updated description',
        }),
      );
    });

    it('does not update a completed or archived project', async () => {
      projectRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(
          projectId,
          updateProjectDto,
          ownerId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(projectRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('changes status regardless of the current project status', async () => {
      projectRepository.findOne.mockResolvedValue({
        ...activeProject,
        status: StatusEnum.COMPLETED,
      });

      await service.updateStatus(
        projectId,
        { status: StatusEnum.IN_PROGRESS },
        ownerId,
      );

      expect(projectRepository.findOne).toHaveBeenCalledWith({
        where: { project_id: projectId },
      });
      expect(projectRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: StatusEnum.IN_PROGRESS }),
      );
    });
  });

  describe('permanentlyRemove', () => {
    it('deletes an archived project and its related records', async () => {
      projectRepository.findOne.mockResolvedValue({
        ...activeProject,
        status: StatusEnum.CANCELED,
      });
      taskRepository.find.mockResolvedValue([
        { task_id: '66666666-6666-6666-6666-666666666666' },
      ]);

      await service.permanentlyRemove(projectId, ownerId);

      expect(taskAssigneeRepository.delete).toHaveBeenCalled();
      expect(taskRepository.delete).toHaveBeenCalledTimes(2);
      expect(projectMemberRepository.delete).toHaveBeenCalledWith({
        project_id: projectId,
      });
      expect(projectRepository.delete).toHaveBeenCalledWith({
        project_id: projectId,
      });
    });

    it('rejects permanent deletion unless the project is archived', async () => {
      mockOwnedProject();

      await expect(
        service.permanentlyRemove(projectId, ownerId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(projectRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    it('updates project positions in the requested order', async () => {
      projectMemberRepository.find.mockResolvedValue([
        { project_id: projectId, user_id: ownerId },
        { project_id: firstUserId, user_id: ownerId },
      ]);
      projectRepository.find.mockResolvedValue([
        { project_id: projectId, status: StatusEnum.IN_PROGRESS, position: 1 },
        { project_id: firstUserId, status: StatusEnum.IN_PROGRESS, position: 2 },
      ]);

      await service.reorder(
        {
          status: StatusEnum.IN_PROGRESS,
          project_ids: [firstUserId, projectId],
        },
        ownerId,
      );

      expect(projectRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ project_id: firstUserId, position: 1 }),
        expect.objectContaining({ project_id: projectId, position: 2 }),
      ]);
    });

    it('rejects an incomplete project list', async () => {
      projectMemberRepository.find.mockResolvedValue([
        { project_id: projectId, user_id: ownerId },
        { project_id: firstUserId, user_id: ownerId },
      ]);
      projectRepository.find.mockResolvedValue([
        { project_id: projectId, status: StatusEnum.IN_PROGRESS, position: 1 },
        { project_id: firstUserId, status: StatusEnum.IN_PROGRESS, position: 2 },
      ]);

      await expect(
        service.reorder(
          { status: StatusEnum.IN_PROGRESS, project_ids: [projectId] },
          ownerId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('addMembers', () => {
    it('adds multiple users to a project', async () => {
      mockOwnedProject();
      userRepository.find.mockResolvedValue([
        { user_id: firstUserId },
        { user_id: secondUserId },
      ]);
      projectMemberRepository.find.mockResolvedValue([]);

      const result = await service.addMembers(
        projectId,
        { user_ids: [firstUserId, secondUserId] },
        ownerId,
      );

      expect(projectMemberRepository.create).toHaveBeenCalledWith([
        {
          project_id: projectId,
          user_id: firstUserId,
          role: MemberRoleEnum.MEMBER,
        },
        {
          project_id: projectId,
          user_id: secondUserId,
          role: MemberRoleEnum.MEMBER,
        },
      ]);
      expect(projectMemberRepository.save).toHaveBeenCalledWith([
        {
          project_id: projectId,
          user_id: firstUserId,
          role: MemberRoleEnum.MEMBER,
        },
        {
          project_id: projectId,
          user_id: secondUserId,
          role: MemberRoleEnum.MEMBER,
        },
      ]);
      expect(result).toEqual({
        message: 'Đã thêm user vào dự án',
        project_id: projectId,
        user_ids: [firstUserId, secondUserId],
        role: MemberRoleEnum.MEMBER,
      });
    });

    it('throws when any user does not exist', async () => {
      mockOwnedProject();
      userRepository.find.mockResolvedValue([{ user_id: firstUserId }]);

      await expect(
        service.addMembers(
          projectId,
          { user_ids: [firstUserId, secondUserId] },
          ownerId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when any user is already a member', async () => {
      mockOwnedProject();
      userRepository.find.mockResolvedValue([
        { user_id: firstUserId },
        { user_id: secondUserId },
      ]);
      projectMemberRepository.find.mockResolvedValue([
        { user_id: secondUserId },
      ]);

      await expect(
        service.addMembers(
          projectId,
          { user_ids: [firstUserId, secondUserId] },
          ownerId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('removeMembers', () => {
    it('removes multiple users from a project', async () => {
      mockOwnedProject();
      taskRepository.find.mockResolvedValue([
        { task_id: '66666666-6666-6666-6666-666666666666' },
      ]);
      projectMemberRepository.find.mockResolvedValue([
        { user_id: firstUserId },
        { user_id: secondUserId },
      ]);

      const result = await service.removeMembers(
        projectId,
        { user_ids: [firstUserId, secondUserId] },
        ownerId,
      );

      expect(projectMemberRepository.delete).toHaveBeenCalledWith({
        project_id: projectId,
        user_id: expect.any(Object),
      });
      expect(taskAssigneeRepository.delete).toHaveBeenCalledWith({
        task_id: expect.any(Object),
        user_id: expect.any(Object),
      });
      expect(result).toEqual({
        message: 'Đã xóa user khỏi dự án',
        project_id: projectId,
        user_ids: [firstUserId, secondUserId],
      });
    });

    it('does not remove the project owner', async () => {
      mockOwnedProject();

      await expect(
        service.removeMembers(projectId, { user_ids: [ownerId] }, ownerId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(projectMemberRepository.delete).not.toHaveBeenCalled();
    });

    it('throws when any user is not a project member', async () => {
      mockOwnedProject();
      projectMemberRepository.find.mockResolvedValue([
        { user_id: firstUserId },
      ]);

      await expect(
        service.removeMembers(
          projectId,
          { user_ids: [firstUserId, secondUserId] },
          ownerId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
