import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Project, StatusEnum } from '../projects/entities/project.entity';
import {
  MemberRoleEnum,
  ProjectMember,
} from '../project-members/project-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { User, UserRoleEnum } from '../users/entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async findByProject(projectId: string, userId: string) {
    await this.ensureProjectAccess(projectId, userId, false);

    return this.commentRepository.find({
      where: { project_id: projectId },
      relations: { user: true },
      order: { created_at: 'ASC' },
    });
  }

  async create(projectId: string, dto: CreateCommentDto, userId: string) {
    await this.ensureProjectAccess(projectId, userId, true);
    if (!dto.content.trim()) {
      throw new BadRequestException('Nội dung comment không được để trống');
    }

    if (dto.task_id) {
      const task = await this.taskRepository.findOne({
        where: { task_id: dto.task_id, project_id: projectId },
      });
      if (!task) throw new BadRequestException('Task không thuộc project');
    }

    const comment = this.commentRepository.create({
      project_id: projectId,
      task_id: dto.task_id ?? null,
      user_id: userId,
      content: dto.content.trim(),
    });
    const saved = await this.commentRepository.save(comment);

    const created = await this.commentRepository.findOne({
      where: { comment_id: saved.comment_id },
      relations: { user: true },
    });
    if (created) {
      this.realtimeGateway.emitProjectEvent(projectId, 'comment.created', {
        comment: created,
      });
    }

    return created;
  }

  async remove(commentId: string, userId: string) {
    const comment = await this.commentRepository.findOne({
      where: { comment_id: commentId },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy comment');

    const membership = await this.ensureProjectAccess(
      comment.project_id,
      userId,
      false,
    );
    const canManage =
      membership === 'admin' ||
      membership.role === MemberRoleEnum.OWNER ||
      membership.role === MemberRoleEnum.MANAGER;
    if (comment.user_id !== userId && !canManage) {
      throw new ForbiddenException('Bạn không có quyền xóa comment này');
    }

    await this.commentRepository.delete({ comment_id: commentId });
    this.realtimeGateway.emitProjectEvent(comment.project_id, 'comment.deleted', {
      comment_id: commentId,
    });
    return { message: 'Đã xóa comment', comment_id: commentId };
  }

  async update(commentId: string, dto: UpdateCommentDto, userId: string) {
    const comment = await this.commentRepository.findOne({
      where: { comment_id: commentId },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy comment');

    await this.ensureProjectAccess(comment.project_id, userId, true);
    if (comment.user_id !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể sửa comment của mình');
    }

    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Nội dung comment không được để trống');
    }

    comment.content = content;
    comment.edited_at = new Date();
    await this.commentRepository.save(comment);
    const updated = await this.commentRepository.findOne({
      where: { comment_id: commentId },
      relations: { user: true },
    });
    if (updated) {
      this.realtimeGateway.emitProjectEvent(updated.project_id, 'comment.updated', {
        comment: updated,
      });
    }

    return updated;
  }

  private async ensureProjectAccess(
    projectId: string,
    userId: string,
    requireActive: boolean,
  ) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });
    const project = await this.projectRepository.findOne({
      where: { project_id: projectId },
    });
    if (!project || (requireActive && project.status !== StatusEnum.ACTIVE)) {
      throw new NotFoundException('Không tìm thấy dự án');
    }
    if (user?.role === UserRoleEnum.ADMIN) return 'admin' as const;

    const membership = await this.projectMemberRepository.findOne({
      where: { project_id: projectId, user_id: userId },
    });
    if (!membership) {
      throw new ForbiddenException('Bạn không thuộc project này');
    }
    return membership;
  }
}
