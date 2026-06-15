import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import {
  MemberRoleEnum,
  ProjectMember,
} from '../project-members/project-member.entity';
import { User } from '../users/entities/user.entity';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectRepository: Record<string, jest.Mock>;
  let projectMemberRepository: Record<string, jest.Mock>;
  let userRepository: Record<string, jest.Mock>;

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
    status: 'active',
  };

  const mockOwnedProject = () => {
    projectRepository.findOne.mockResolvedValue(activeProject);
  };

  beforeEach(async () => {
    projectRepository = createRepositoryMock();
    projectMemberRepository = createRepositoryMock();
    userRepository = createRepositoryMock();

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
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
